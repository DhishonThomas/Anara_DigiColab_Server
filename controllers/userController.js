import ErrorHandler from "../middlewares/error.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { User } from "../models/userModel.js";
import { Volunteer } from "../models/volunteerModel.js";
import { sendEmail } from "../utils/sendEmail.js";
import { sendToken } from "../utils/sendToken.js";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { cloudinaryInstance } from "../config/cloudinary.js";
import streamifier from "streamifier";
import { JobRole } from "../models/JobRoles.js";
import { Course } from "../models/Course.js";
import dotenv from "dotenv";
dotenv.config({ path: "./config.env" });

// Enhanced OTP store with additional tracking
const otpStore = new Map();

// Helper function to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

// Helper function to validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to send OTP email
const sendOTPEmail = async (email, otp) => {
  const message = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f9f9f9;
            padding: 0;
            margin: 0;
          }
          .email-container {
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            color: #4caf50;
          }
          .otp-box {
            font-size: 32px;
            font-weight: bold;
            color: #ffffff;
            background-color: #4caf50;
            padding: 10px 20px;
            border-radius: 8px;
            text-align: center;
            display: inline-block;
            margin: 20px auto;
          }
          p {
            font-size: 16px;
            color: #333;
            line-height: 1.6;
          }
          h6 {
            font-size: 14px;
            color: #808080;
            line-height: 1.6;
          }  
          .footer {
            font-size: 12px;
            color: #aaa;
            text-align: center;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <h1 class="header">Your OTP for Email Verification</h1>
          <p>Dear User,</p>
          <p>Please use the following One-Time Password (OTP) to verify your email:</p>
          <div class="otp-box">${otp}</div>
          <p>This code is valid for the next 5 minutes. Please do not share this code with anyone.</p>
          <p>If you did not request this, please ignore this email.</p>
          <div class="footer">
            <p>Thank you</p>
            <h6>This is an automated message. Please do not reply to this email.</h6>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendEmail({ email, subject: "Email Verification OTP", message });
};

// Send email OTP
export const sendEmailOTP = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;

  // Validate email presence
  if (!email) {
    return next(new ErrorHandler("Email is required.", 400));
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return next(new ErrorHandler("Please provide a valid email address.", 400));
  }

  // Check if email is already registered
  const user = await User.findOne({ email });
  if (user) {
    return next(new ErrorHandler("Email is already registered.", 400));
  }

  // Check if there's an existing OTP request for this email
  const existingOtpData = otpStore.get(email);

  // Check if OTP verification is already done
  if (existingOtpData && existingOtpData.verified) {
    return res.status(200).json({
      success: true,
      otpStatus: "verified",
      message: "Email is already verified.",
    });
  }

  // If OTP exists and hasn't expired, check if 5 minutes have passed for resend
  if (existingOtpData && !existingOtpData.verified) {
    const timeElapsed = Date.now() - existingOtpData.sentAt;
    const fiveMinutes = 5 * 60 * 1000;

    if (timeElapsed < fiveMinutes) {
      const remainingTime = Math.ceil((fiveMinutes - timeElapsed) / 1000);
      return next(
        new ErrorHandler(
          `Please wait ${remainingTime} seconds before requesting a new OTP.`,
          429
        )
      );
    }
  }

  const otp = generateOTP();
  const otpExpire = Date.now() + 5 * 60 * 1000; // 5 minutes expiry
  const sentAt = Date.now();

  // Store OTP with additional metadata
  otpStore.set(email, {
    otp,
    otpExpire,
    sentAt,
    attempts: 0,
    verified: false,
  });

  try {
    await sendOTPEmail(email, otp);

    res.status(200).json({
      success: true,
      otpStatus: "sent",
      message: "OTP sent successfully.",
    });
  } catch (error) {
    // Remove OTP from store if email sending fails
    otpStore.delete(email);
    console.error("Email sending error:", error);
    return next(new ErrorHandler("Failed to send OTP. Please try again.", 500));
  }
});

// Resend OTP function
export const resendEmailOTP = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;

  // Validate email presence
  if (!email) {
    return next(new ErrorHandler("Email is required.", 400));
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return next(new ErrorHandler("Please provide a valid email address.", 400));
  }

  // Check if email is already registered
  const user = await User.findOne({ email });
  if (user) {
    return next(new ErrorHandler("Email is already registered.", 400));
  }

  const existingOtpData = otpStore.get(email);

  // Check if there's a previous OTP request
  if (!existingOtpData) {
    return next(
      new ErrorHandler("No OTP request found. Please request a new OTP.", 400)
    );
  }

  // Check if OTP is already verified
  if (existingOtpData.verified) {
    return next(new ErrorHandler("Email is already verified.", 400));
  }

  // Check if 5 minutes have passed since last OTP
  const timeElapsed = Date.now() - existingOtpData.sentAt;
  const fiveMinutes = 5 * 60 * 1000;

  if (timeElapsed < fiveMinutes) {
    const remainingTime = Math.ceil((fiveMinutes - timeElapsed) / 1000);
    return next(
      new ErrorHandler(
        `Please wait ${remainingTime} seconds before requesting a new OTP.`,
        429
      )
    );
  }

  // Generate new OTP
  const otp = generateOTP();
  const otpExpire = Date.now() + 5 * 60 * 1000;
  const sentAt = Date.now();

  // Update OTP store
  otpStore.set(email, {
    otp,
    otpExpire,
    sentAt,
    attempts: 0,
    verified: false,
  });

  try {
    await sendOTPEmail(email, otp);

    res.status(200).json({
      success: true,
      message: "OTP resent successfully.",
      canResendAfter: 5 * 60 * 1000, // 5 minutes in milliseconds
    });
  } catch (error) {
    console.error("Email sending error:", error);
    return next(new ErrorHandler("Failed to send OTP. Please try again.", 500));
  }
});

// Check OTP status and resend availability
export const checkOTPStatus = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ErrorHandler("Email is required.", 400));
  }

  const otpData = otpStore.get(email);

  if (!otpData) {
    return res.status(200).json({
      success: true,
      otpExists: false,
      canResend: true,
      message: "No OTP found for this email.",
    });
  }

  const timeElapsed = Date.now() - otpData.sentAt;
  const fiveMinutes = 5 * 60 * 1000;
  const canResend = timeElapsed >= fiveMinutes;
  const isExpired = Date.now() > otpData.otpExpire;

  let remainingTime = 0;
  if (!canResend) {
    remainingTime = Math.ceil((fiveMinutes - timeElapsed) / 1000);
  }

  res.status(200).json({
    success: true,
    otpExists: true,
    canResend,
    isExpired,
    verified: otpData.verified || false,
    remainingTime,
    attempts: otpData.attempts || 0,
  });
});

// Verify OTP with enhanced validation
export const verifyEmailOTP = catchAsyncError(async (req, res, next) => {
  const { email, otp } = req.body;

  // Validate input
  if (!email || !otp) {
    return next(new ErrorHandler("Email and OTP are required.", 400));
  }

  if (!isValidEmail(email)) {
    return next(new ErrorHandler("Please provide a valid email address.", 400));
  }

  // Validate OTP format (6 digits)
  if (!/^\d{6}$/.test(otp)) {
    return next(new ErrorHandler("OTP must be a 6-digit number.", 400));
  }

  const storedOtpData = otpStore.get(email);

  if (!storedOtpData) {
    return next(
      new ErrorHandler("OTP not found. Please request a new OTP.", 400)
    );
  }

  // Check if already verified
  if (storedOtpData.verified) {
    return next(new ErrorHandler("Email is already verified.", 400));
  }

  const { otp: storedOtp, otpExpire, attempts = 0 } = storedOtpData;

  // Check expiry
  if (Date.now() > otpExpire) {
    otpStore.delete(email);
    return next(
      new ErrorHandler("OTP has expired. Please request a new one.", 400)
    );
  }

  // Check maximum attempts (prevent brute force)
  if (attempts >= 5) {
    otpStore.delete(email);
    return next(
      new ErrorHandler(
        "Maximum verification attempts exceeded. Please request a new OTP.",
        400
      )
    );
  }

  // Verify OTP
  if (parseInt(otp) !== storedOtp) {
    // Increment attempts
    otpStore.set(email, {
      ...storedOtpData,
      attempts: attempts + 1,
    });

    const remainingAttempts = 5 - (attempts + 1);
    return next(
      new ErrorHandler(
        `Invalid OTP. ${remainingAttempts} attempts remaining.`,
        400
      )
    );
  }

  // Mark OTP as verified
  otpStore.set(email, {
    ...storedOtpData,
    verified: true,
  });

  res.status(200).json({
    success: true,
    message: "Email verified successfully.",
  });
});

// Clean up expired OTPs (optional - can be called periodically)
export const cleanupExpiredOTPs = () => {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (now > data.otpExpire && !data.verified) {
      otpStore.delete(email);
    }
  }
};

// Your existing functions remain the same...
export const uploadToCloudinary = (buffer, folder, resourceType = "auto") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinaryInstance.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

//Register
export const register = catchAsyncError(async (req, res, next) => {
  const {
    name,
    age,
    email,
    phone,
    password,
    guardian,
    address,
    currentAddress,
    state,
    city,
    district,
    pincode,
    dob,
    gender,
    bankAccNumber,
    bankName,
    ifsc,
    volunteerRegNum,
    pwdCategory,
    entrepreneurshipInterest,
    undertaking,
    educationQualification,
  } = req.body;

  try {
    // Check for required fields
    if (
      !name ||
      !age ||
      !email ||
      !phone ||
      !password ||
      !guardian ||
      !address ||
      !currentAddress ||
      !state ||
      !district ||
      !pincode ||
      !city ||
      !dob ||
      !gender ||
      !bankAccNumber ||
      !bankName ||
      !ifsc ||
      !volunteerRegNum ||
      pwdCategory === undefined ||
      entrepreneurshipInterest === undefined ||
      undertaking === undefined ||
      !educationQualification
    ) {
      return next(new ErrorHandler("All fields are required.", 400));
    }

    // Check if email and phone are unique
    const emailExists = await User.findOne({ email });
    const phoneExists = await User.findOne({ phone });

    if (emailExists || phoneExists) {
      return next(
        new ErrorHandler("Email or phone is already registered.", 400)
      );
    }

    // Check if email is verified by OTP
    if (!otpStore.get(email)?.verified) {
      return next(
        new ErrorHandler(
          "Email is not verified. Please verify your email first.",
          400
        )
      );
    }

    // Volunteer verification
    const volunteerExists = await Volunteer.findOne({
      tempRegNumber: volunteerRegNum,
    });

    if (!volunteerExists) {
      return next(
        new ErrorHandler(
          "Invalid Volunteer Registration Number. Please check and try again.",
          400
        )
      );
    }

    // Check for required documents
    if (
      !req.files ||
      !req.files.image ||
      !req.files.educationDocument ||
      !req.files.bankPassbook
    ) {
      return next(
        new ErrorHandler("All required documents must be uploaded.", 400)
      );
    }

    // Validate education qualification
    const validEducationQualifications = [
      "5th",
      "6th",
      "7th",
      "8th",
      "9th",
      "10th",
      "ITI",
    ];
    if (!validEducationQualifications.includes(educationQualification)) {
      return next(
        new ErrorHandler("Please select a valid education qualification.", 400)
      );
    }

    if (undertaking !== "true" && undertaking !== true) {
      return next(new ErrorHandler("Confirmation is required.", 400));
    }

    if (pwdCategory === "Yes" && !req.files.pwdCertificate) {
      return next(new ErrorHandler("PWD Certificate is required.", 400));
    }

    if (entrepreneurshipInterest === "Yes" && !req.files.bplCertificate) {
      return next(
        new ErrorHandler(
          "BPL/marginalized category certificate is required.",
          400
        )
      );
    }

    // Auto-generate unique regNumber - FIXED CODE HERE
    const lastUser = await User.findOne().sort({ createdAt: -1 });
    let nextNumber = 1;
    if (lastUser && lastUser.regNumber) {
      const match = lastUser.regNumber.match(/\d+$/);
      if (match) nextNumber = parseInt(match[0]) + 1;
    }
    const regNumber = `ASF/CANDIDATE/${nextNumber.toString().padStart(5, "0")}`;

    // Check for duplicate regNumber (edge case)
    const existingUser = await User.findOne({ regNumber });
    if (existingUser) {
      return next(
        new ErrorHandler(
          "User with this registration number already exists.",
          400
        )
      );
    }

    // Debugging: Check if regNumber is null
    console.log("Generated regNumber:", regNumber);

    if (!regNumber) {
      return next(
        new ErrorHandler("Failed to generate registration number.", 500)
      );
    }
    const validBankAccNumber =
      bankAccNumber && bankAccNumber.trim() !== ""
        ? bankAccNumber
        : "Not Provided";

    // Upload Files to Cloudinary
    const image = await uploadToCloudinary(req.files.image[0].buffer, "users");
    const educationDocument = await uploadToCloudinary(
      req.files.educationDocument[0].buffer,
      "documents"
    );
    const bankPassbook = await uploadToCloudinary(
      req.files.bankPassbook[0].buffer,
      "documents"
    );

    // Police verification optional
    const policeVerification = req.files.policeVerification
      ? await uploadToCloudinary(
          req.files.policeVerification[0].buffer,
          "documents"
        )
      : null;

    const pwdCertificate =
      pwdCategory === "Yes"
        ? await uploadToCloudinary(
            req.files.pwdCertificate[0].buffer,
            "documents"
          )
        : null;
    const bplCertificate =
      entrepreneurshipInterest === "Yes"
        ? await uploadToCloudinary(
            req.files.bplCertificate[0].buffer,
            "documents"
          )
        : null;

    const user = await User.create({
      name,
      age,
      email,
      phone,
      password,
      guardian,
      address,
      currentAddress,
      state,
      district,
      pincode,
      city,
      dob,
      gender,
      bankAccNumber: validBankAccNumber,
      bankName,
      ifsc,
      volunteerRegNum,
      pwdCategory,
      entrepreneurshipInterest,
      undertaking,
      image,
      policeVerification,
      educationQualification,
      educationDocument,
      bankPassbook,
      pwdCertificate,
      bplCertificate,
      accountVerified: true,
      regNumber,
    });

    // Add this user under the volunteer
    volunteerExists.usersUnderVolunteer.push(user._id);
    await volunteerExists.save();

    // Send registration confirmation email to the user
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_MAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      const mailOptions = {
        from: "contactus@anaraskills.org",
        to: email,
        subject:
          "Welcome to Anara Skills Foundation - Your Registration is Successful!",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #007bff; text-align: center;">🌟 Welcome to Anara Skills Foundation, ${name}! 🌟</h2>
            <p style="font-size: 16px;">Dear ${name},</p>
            <p>We are delighted to have you on board! Your registration with Anara Skills Foundation has been successfully completed. Below are your details:</p>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;">
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Registration Number:</strong> ${regNumber}</p>
              <p><strong>Education Qualification:</strong> ${educationQualification}</p>
            </div>
            
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Thank you for choosing Anara Skills Foundation! We look forward to having you as part of our community.</p>
            <hr style="border: none; border-top: 1px solid #ddd;">
            <p style="text-align: center; font-size: 12px; color: #888;">This is an automated email, please do not reply.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log("Registration confirmation email sent to:", email);
    } catch (error) {
      console.log("Error sending registration email:", error);
    }

    res.status(201).json({
      success: true,
      message: "User registered successfully.",
      user,
    });
  } catch (error) {
    console.log(error);
    return next(new ErrorHandler(error, 500));
  }
});

//Login
export const login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorHandler("Email and password are required.", 400));
  }

  const user = await User.findOne({ email }).select("+password");

  if (user.isBlocked) {
    return res
      .status(403)
      .json({ message: "Access denied. Candidate is blocked." });
  }

  if (!user || !user.accountVerified) {
    return next(
      new ErrorHandler(
        "Account not verified. Please verify your email first.",
        400
      )
    );
  }

  const isPasswordMatched = await user.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password.", 400));
  }
  sendToken(user, 200, "User logged in successfully.", res);
});

//Logout
export const logout = catchAsyncError(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", "", {
      expires: new Date(Date.now()),
      httpOnly: true,
    })
    .json({
      success: true,
      message: "Logged out successfully.",
    });
});

//Forgot Password
export const forgotPassword = catchAsyncError(async (req, res, next) => {
  const user = await User.findOne({
    email: req.body.email,
    accountVerified: true,
  });

  if (!user) {
    return next(new ErrorHandler("User not found.", 404));
  }

  const resetToken = user.generateResetPasswordToken();
  await user.save({ validateBeforeSave: false });
  const resetPasswordUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  const message = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>Hi,</p>
      <p>We received a request to reset your password. You can reset it using the link below:</p>
      <p><strong>Reset Password Link:</strong></p>
      <p style="word-break: break-all; color: #007bff;">${resetPasswordUrl}</p>
      <p>If you did not request a password reset, please ignore this email if you have concerns.</p>
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>Best regards,<br>Anara Skills Foundation Team</p>
    </div>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: "Reset Password",
      message,
    });
    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully.`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorHandler("Cannot send reset password token.", 500));
  }
});

//Reset Password
export const resetPassword = catchAsyncError(async (req, res, next) => {
  const { token } = req.params;
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(
      new ErrorHandler("Reset password token is invalid or has expired.", 400)
    );
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(
      new ErrorHandler("Password and confirm password do not match.", 400)
    );
  }
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();
  sendToken(user, 200, "Reset Password Successfully.", res);
});

//Get User
export const getUser = catchAsyncError(async (req, res, next) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    user,
  });
});

//--------Dashboard-------------

//CCC cetificate
export const updateCCCStatus = catchAsyncError(async (req, res, next) => {
  const { cccCertified } = req.body;

  if (!cccCertified) {
    return next(new ErrorHandler("CCC certification status is required", 400));
  }

  const user = req.user;

  if (cccCertified === "Yes" && !req.files?.cccCertificate) {
    return next(new ErrorHandler("CCC Certificate is required", 400));
  }

  user.cccCertified = cccCertified;

  if (cccCertified === "Yes" && req.files?.cccCertificate) {
    const certificateUrl = await uploadToCloudinary(
      req.files.cccCertificate[0].buffer,
      "certificates"
    );
    user.cccCertificate = certificateUrl;
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: "CCC certification status updated successfully",
    user,
  });
});

//Check CCC
export const checkCCCStatus = catchAsyncError(async (req, res, next) => {
  const user = req.user;

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  res.status(200).json({
    success: true,
    cccCertified: user.cccCertified === "Yes" ? true : false,
  });
});

//---------Job-roles and courses------------

// Get all courses for user
export const getCoursesForUser = catchAsyncError(async (req, res, next) => {
  const userQualification = req.user.educationQualification;
  const qualificationOrder = ["5th", "6th", "7th", "8th", "9th", "10th", "ITI"];

  const userIndex = qualificationOrder.indexOf(userQualification);
  if (userIndex === -1) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid qualification" });
  }

  if (!userQualification) {
    return res.status(400).json({
      success: false,
      message: "User qualification not found",
    });
  }

  const jobRoles = await JobRole.find()
    .select("name description courses")
    .populate({
      path: "courses",
      select: "title description duration qualifications image", // include qualification for filtering
    });

  // Filter courses based on qualification
  const filteredJobRoles = jobRoles
    .map((role) => {
      const eligibleCourses = role.courses.filter((course) => {
        const courseIndex = qualificationOrder.indexOf(course.qualifications);
        return courseIndex !== -1 && courseIndex <= userIndex;
      });
      return {
        ...role._doc,
        courses: eligibleCourses,
      };
    })
    .filter((role) => role.courses.length > 0);

  res.status(200).json({ success: true, jobRoles: filteredJobRoles });
});

// Search courses based on name
export const searchCourses = catchAsyncError(async (req, res, next) => {
  const { keyword } = req.query;

  if (!keyword) {
    return next(new ErrorHandler("Keyword is required.", 400));
  }

  const courses = await Course.find({
    $or: [
      { title: { $regex: keyword, $options: "i" } },
      { description: { $regex: keyword, $options: "i" } },
    ],
  });

  res.status(200).json({
    success: true,
    totalCourses: courses.length,
    courses,
  });
});

// Save selected course
export const selectCourse = catchAsyncError(async (req, res, next) => {
  const { courseId } = req.body;
  const userId = req.user._id;

  if (!courseId) {
    return next(new ErrorHandler("Course ID is required", 400));
  }

  const user = await User.findById(userId);
  if (!user) return next(new ErrorHandler("User not found", 404));

  // Validate course exists
  const courseExists = await Course.findById(courseId);
  if (!courseExists) {
    return next(new ErrorHandler("Invalid course ID", 400));
  }

  user.selectedCourse = courseId;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Course selected successfully",
    user,
  });
});

//Update course
export const updateCourses = catchAsyncError(async (req, res, next) => {
  const { courseId } = req.body;
  const userId = req.user._id;

  if (!courseId) {
    return next(new ErrorHandler("Course ID must be provided", 400));
  }

  const user = await User.findById(userId);
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Validate and update courseId
  const courseExists = await Course.findById(courseId);
  if (!courseExists) {
    return next(new ErrorHandler("Invalid course ID", 400));
  }

  user.selectedCourse = courseId;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Course updated successfully.",
  });
});

// Updated to check only selected course
export const checkCourseSelection = catchAsyncError(async (req, res, next) => {
  const user = req.user;

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Check if user has selected a course
  const hasSelectedCourse = user.selectedCourse ? true : false;

  // Get more details about the selected course if it exists
  let courseDetails = null;
  if (hasSelectedCourse) {
    courseDetails = await Course.findById(user.selectedCourse).select(
      "name description duration level"
    );
  }

  res.status(200).json({
    success: true,
    hasSelectedCourse,
  });
});
