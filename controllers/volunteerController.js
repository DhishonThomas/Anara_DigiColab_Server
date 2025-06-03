import ErrorHandler from "../middlewares/error.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { Volunteer } from "../models/volunteerModel.js";
import { sendEmail } from "../utils/sendEmail.js";
import { sendToken } from "../utils/sendToken.js";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { User } from "../models/userModel.js";
import { cloudinaryInstance } from "../config/cloudinary.js";
import streamifier from "streamifier";
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
  const volunteer = await Volunteer.findOne({ email });
  if (volunteer) {
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
  const volunteer = await Volunteer.findOne({ email });
  if (volunteer) {
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
    email,
    phone,
    password,
    guardian,
    age,
    address,
    currentAddress,
    state,
    district,
    city,
    pincode,
    dob,
    gender,
    bankAccNumber,
    bankName,
    ifsc,
    educationDegree,
    educationYearOfCompletion,
    employmentStatus,
    monthlyIncomeRange,
    undertaking,
  } = req.body;

  try {
    const requiredFields = {
      name,
      email,
      phone,
      password,
      guardian,
      age,
      address,
      currentAddress,
      state,
      district,
      city,
      pincode,
      dob,
      gender,
      bankAccNumber,
      bankName,
      ifsc,
      educationDegree,
      educationYearOfCompletion,
      employmentStatus,
      undertaking,
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return next(
        new ErrorHandler(
          `Missing required field(s): ${missingFields.join(", ")}`,
          400
        )
      );
    }

    // Check if email and phone are unique
    const emailExists = await Volunteer.findOne({ email });
    const phoneExists = await Volunteer.findOne({ phone });

    if (emailExists || phoneExists) {
      return next(
        new ErrorHandler("Email or phone is already registered.", 400)
      );
    }

    // Check if the email is verified by OTP
    if (!otpStore.get(email)?.verified) {
      return next(
        new ErrorHandler(
          "Email is not verified. Please verify your email first.",
          400
        )
      );
    }

    if (undertaking !== "true" && undertaking !== true) {
      return next(new ErrorHandler("Confirmation is required.", 400));
    }

    if (employmentStatus === "Employed" && !monthlyIncomeRange) {
      return next(
        new ErrorHandler(
          "Monthly income range is required for employed volunteers.",
          400
        )
      );
    }

    if (
      !req.files ||
      !req.files.image ||
      !req.files.educationCertificate ||
      !req.files.bankDocument
    ) {
      return next(
        new ErrorHandler("All required documents must be uploaded.", 400)
      );
    }

    const count = await Volunteer.countDocuments();
    console.log(count);

    const tempRegNumber = `ASF/FE/${String(count + 1).padStart(5, "0")}`;

    const image = await uploadToCloudinary(req.files.image[0].buffer, "users");
    const educationCertificate = await uploadToCloudinary(
      req.files.educationCertificate[0].buffer,
      "documents"
    );
    const bankDocument = await uploadToCloudinary(
      req.files.bankDocument[0].buffer,
      "documents"
    );

    let policeVerification = null;
    if (req.files.policeVerification && req.files.policeVerification[0]) {
      policeVerification = await uploadToCloudinary(
        req.files.policeVerification[0].buffer,
        "documents"
      );
    }

    const volunteerData = {
      name,
      email,
      phone,
      password,
      guardian,
      address,
      state,
      district,
      city,
      pincode,
      age,
      currentAddress,
      dob,
      gender,
      bankAccNumber,
      bankName,
      ifsc,
      employmentStatus,
      image,
      undertaking: undertaking === "true" || undertaking === true,
      educationQualification: {
        degree: educationDegree,
        yearOfCompletion: educationYearOfCompletion,
        certificate: educationCertificate,
      },
      bankDocument,
      accountVerified: true,
      tempRegNumber,
    };

    if (policeVerification) {
      volunteerData.policeVerification = policeVerification;
    }

    if (employmentStatus === "Employed") {
      volunteerData.monthlyIncomeRange = monthlyIncomeRange;
    }

    const volunteer = await Volunteer.create(volunteerData);

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
        subject: "Welcome to Anara Skills Foundation - Registration Successful",
        html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #007bff; text-align: center;">🌟 Welcome to Anara Skills Foundation, ${name}! 🌟</h2>
        <p style="font-size: 16px;">Dear Volunteer ${name},</p>
        <p>We are delighted to have you on board! Your registration with Anara Skills Foundation has been successfully completed. Below are your details:</p>
        <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Registration Number:</strong> ${tempRegNumber}</p>
        </div>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Thank you for choosing Anara Skills Foundation! We look forward to having you as part of our community.</p>
        <hr style="border: none; border-top: 1px solid #ddd;">
        <p style="text-align: center; font-size: 12px; color: #888;">This is an automated email, please do not reply.</p>
      </div>
    `,
      };

      await transporter.sendMail(mailOptions);
      console.log("Welcome email sent to:", email);
    } catch (error) {
      console.log("Error sending welcome email:", error);
    }

    res.status(201).json({
      success: true,
      message: "Volunteer registered successfully.",
      volunteer,
    });
  } catch (error) {
    console.log(error);
    return next(new ErrorHandler("Internal Server Error", 500));
  }
});

//Login
export const login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ErrorHandler("Email and password are required.", 400));
  }

  const volunteer = await Volunteer.findOne({ email }).select("+password");

  if (volunteer.isBlocked) {
    return res
      .status(403)
      .json({ message: "Access denied. Volunteer is blocked." });
  }

  if (!volunteer || !volunteer.accountVerified) {
    return next(
      new ErrorHandler(
        "Account not verified. Please verify your email first.",
        400
      )
    );
  }

  const isPasswordMatched = await volunteer.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password.", 400));
  }
  sendToken(volunteer, 200, "Volunteer logged in successfully.", res);
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
  const volunteer = await Volunteer.findOne({
    email: req.body.email,
    accountVerified: true,
  });

  if (!volunteer) {
    return next(new ErrorHandler("Volunteer not found.", 404));
  }

  const resetToken = volunteer.generateResetPasswordToken();
  await volunteer.save({ validateBeforeSave: false });
  const resetPasswordUrl = `${process.env.FRONTEND_URL}/volunteer/reset-password/${resetToken}`;

  const message = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>Hi,</p>
      <p>We received a request to reset your password. You can reset it using the link below:</p>
      <p><strong>Reset Password Link:</strong></p>
      <p style="word-break: break-all; color: #007bff;">${resetPasswordUrl}</p>
      <p>If you did not request a password reset, please ignore this email if you have concerns.</p>
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>Best regards,<br>Anara Team</p>
    </div>
  `;

  try {
    await sendEmail({
      email: volunteer.email,
      subject: "Reset Password",
      message,
    });
    res.status(200).json({
      success: true,
      message: `Email sent to ${volunteer.email} successfully.`,
    });
  } catch (error) {
    volunteer.resetPasswordToken = undefined;
    volunteer.resetPasswordExpire = undefined;
    await volunteer.save({ validateBeforeSave: false });
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

  const volunteer = await Volunteer.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!volunteer) {
    return next(
      new ErrorHandler("Reset password token is invalid or has expired.", 400)
    );
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(
      new ErrorHandler("Password and confirm password do not match.", 400)
    );
  }

  volunteer.password = req.body.password;
  volunteer.resetPasswordToken = undefined;
  volunteer.resetPasswordExpire = undefined;
  await volunteer.save();
  sendToken(volunteer, 200, "Reset Password Successfully.", res);
});

export const getUsersUnderVolunteer = catchAsyncError(
  async (req, res, next) => {
    const volunteer = req.volunteer;

    if (!volunteer) {
      return next(new ErrorHandler("Unauthorized. Please login again.", 401));
    }

    const regNumber = volunteer.tempRegNumber;

    const users = await User.find({ volunteerRegNum: regNumber }).sort({
      createdAt: -1,
    });

    const verifiedUsers = users.filter((user) => user.accountVerified).length;
    const unverifiedUsers = users.length - verifiedUsers;

    res.status(200).json({
      success: true,
      message: "Users under volunteer fetched successfully.",
      stats: {
        totalUsers: users.length,
        verifiedUsers,
        unverifiedUsers,
      },
      users,
    });
  }
);

//Get Volunteer
export const getVolunteer = catchAsyncError(async (req, res, next) => {
  const volunteer = req.volunteer;
  res.status(200).json({
    success: true,
    volunteer,
  });
});
