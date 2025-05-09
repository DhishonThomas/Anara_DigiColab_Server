import ErrorHandler from "../middlewares/error.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { Volunteer } from "../models/volunteerModel.js";
import { sendEmail } from "../utils/sendEmail.js";
import { sendToken } from "../utils/sendToken.js";
import crypto from "crypto";
import nodemailer from 'nodemailer'
import { User } from "../models/userModel.js";
import { cloudinaryInstance } from "../config/cloudinary.js";
import streamifier from "streamifier";
const otpStore = new Map();

//Send email otp
export const sendEmailOTP = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ErrorHandler("Email is required.", 400));
  }

  const volunteer = await Volunteer.findOne({ email });
  if (volunteer) {
    return next(new ErrorHandler("Email is already registered.", 400));
  }

  const otp = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit OTP
  const otpExpire = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

  otpStore.set(email, { otp, otpExpire });

  try {
    const message = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;background-color: #f9f9f9;padding: 0;margin: 0;}
          .email-container {max-width: 600px;margin: 20px auto;padding: 20px;background-color: #ffffff;border-radius: 8px;box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);}
          .header {text-align: center;color: #4caf50;}
          .otp-box {font-size: 32px;font-weight: bold;color: #ffffff;background-color: #4caf50;padding: 10px 20px;border-radius: 8px;text-align: center;display: inline-block;margin: 20px auto;}
          p {font-size: 16px;color: #333;line-height: 1.6;}
          .footer {font-size: 12px;color: #aaa;text-align: center;margin-top: 20px;}
        </style>
      </head>
      <body>
        <div class="email-container">
          <h1 class="header">Your OTP for Email Verification</h1>
          <p>Dear Volunteer,</p>
          <p>Please use the following One-Time Password (OTP) to verify your email:</p>
          <div class="otp-box">${otp}</div>
          <p>This code is valid for the next 5 minutes. Please do not share this code with anyone.</p>
          <p>If you did not request this, please ignore this email.</p>
          <div class="footer">
            <p>Thank you</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
    await sendEmail({ email, subject: "Email Verification OTP", message });
    res.status(200).json({
      success: true,
      message: "OTP sent successfully.",
    });
  } catch (error) {
    return next(new ErrorHandler("Failed to send OTP.", 500));
  }
});





//Verify otp
export const verifyEmailOTP = catchAsyncError(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new ErrorHandler("Email and OTP are required.", 400));
  }

  const storedOtpData = otpStore.get(email);

  if (!storedOtpData) {
    return next(new ErrorHandler("OTP not found or expired.", 400));
  }

  const { otp: storedOtp, otpExpire } = storedOtpData;

  if (Date.now() > otpExpire) {
    otpStore.delete(email);
    return next(new ErrorHandler("OTP Expired.", 400));
  }

  if (parseInt(otp) !== storedOtp) {
    return next(new ErrorHandler("Invalid OTP.", 400));
  }

  // Mark OTP as verified
  otpStore.set(email, { verified: true });

  res.status(200).json({
    success: true,
    message: "Email verified successfully.",
  });
});





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
    name, email, phone, password, guardian, age, address, currentAddress, dob, gender, bankAccNumber, bankName, ifsc, educationDegree, educationYearOfCompletion, employmentStatus, monthlyIncomeRange, undertaking
  } = req.body;

  try {
    if (!name || !email || !phone || !password || !guardian || !age || !address || !currentAddress || !dob || !gender || !bankAccNumber || !bankName ||!ifsc || !educationDegree || !educationYearOfCompletion || !employmentStatus 
      || !monthlyIncomeRange
    ) {
      return next(new ErrorHandler("All fields are required.", 400));
    }

    // Check if undertaking confirmation is provided
    if (undertaking !== 'true' && undertaking !== true) {
      return next(new ErrorHandler("Confirmation is required.", 400));
    }

    // Check if monthly income range is provided when employment status is "Employed"
    if (employmentStatus === "Employed" && !monthlyIncomeRange) {
      return next(new ErrorHandler("Monthly income range is required for employed volunteers.", 400));
    }

    if (!req.files || !req.files.image || !req.files.educationCertificate || !req.files.bankDocument) {
      return next(new ErrorHandler("All required documents must be uploaded.", 400));
    }

    const emailExists = await Volunteer.findOne({ email });
    const phoneExists = await Volunteer.findOne({ phone });

    if (emailExists || phoneExists) {
      return next(new ErrorHandler("Email or phone is already registered.", 400));
    }

    const count = await Volunteer.countDocuments();
    console.log(count);


    const tempRegNumber = `ASF/FE/${String(count + 1).padStart(5, '0')}`;

    const image = await uploadToCloudinary(req.files.image[0].buffer, "users");
    const educationCertificate = await uploadToCloudinary(req.files.educationCertificate[0].buffer, "documents");
    const bankDocument = await uploadToCloudinary(req.files.bankDocument[0].buffer, "documents");

    // Handle the optional police verification document
    let policeVerification = null;
    if (req.files.policeVerification && req.files.policeVerification[0]) {
      policeVerification = await uploadToCloudinary(req.files.policeVerification[0].buffer, "documents");
    }

    const volunteerData = {
      name,
      email,
      phone,
      password,
      guardian,
      address,
      age,
      currentAddress,
      dob,
      gender,
      bankAccNumber,
      bankName,
      ifsc,
      employmentStatus,
      image,
      // undertaking is now a boolean, not a document URL
      undertaking: undertaking === 'true' || undertaking === true,
      educationQualification: {
        degree: educationDegree,
        yearOfCompletion: educationYearOfCompletion,
        certificate: educationCertificate
      },
      bankDocument,
      monthlyIncomeRange,
      accountVerified: true,
      tempRegNumber,
    };

    // Only add policeVerification to volunteerData if it exists
    if (policeVerification) {
      volunteerData.policeVerification = policeVerification;
    }

    // Add monthlyIncomeRange only if employment status is "Employed"
    if (employmentStatus === "Employed") {
      volunteerData.monthlyIncomeRange = monthlyIncomeRange;
    }

    const volunteer = await Volunteer.create(volunteerData);

    // Send welcome email to the volunteer
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "hasanulbanna2255@gmail.com",
          pass: "wflv nsjo ofba rvov",
        },
      });

      const mailOptions = {
        from: "hasanulbanna2255@gmail.com",
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

  if (!volunteer || !volunteer.accountVerified) {
    return next(new ErrorHandler("Account not verified. Please verify your email first.", 400));
  }

  const isPasswordMatched = await volunteer.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password.", 400));
  }
  sendToken(volunteer, 200, "Volunteer logged in successfully.", res);
});





//Logout
export const logout = catchAsyncError(async (req, res, next) => {
  res.status(200).cookie("token", "", {
    expires: new Date(Date.now()),
    httpOnly: true,
  }).json({
    success: true,
    message: "Logged out successfully.",
  });
});





//Forgot Password
export const forgotPassword = catchAsyncError(async (req, res, next) => {
  const volunteer = await Volunteer.findOne({ email: req.body.email, accountVerified: true });

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
  const resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");

  const volunteer = await Volunteer.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!volunteer) {
    return next(new ErrorHandler("Reset password token is invalid or has expired.", 400));
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(new ErrorHandler("Password and confirm password do not match.", 400));
  }

  volunteer.password = req.body.password;
  volunteer.resetPasswordToken = undefined;
  volunteer.resetPasswordExpire = undefined;
  await volunteer.save();
  sendToken(volunteer, 200, "Reset Password Successfully.", res);
});





export const getUsersUnderVolunteer = catchAsyncError(async (req, res, next) => {
  const volunteer = req.volunteer;

  if (!volunteer) {
    return next(new ErrorHandler("Unauthorized. Please login again.", 401));
  }

  const regNumber = volunteer.tempRegNumber;

  // Fetch all fields of users under the volunteer
  const users = await User.find({ volunteerRegNum: regNumber }).sort({ createdAt: -1 });

  const verifiedUsers = users.filter(user => user.accountVerified).length;
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
});






//Get Volunteer
export const getVolunteer = catchAsyncError(async (req, res, next) => {
  const volunteer = req.volunteer;
  res.status(200).json({
    success: true,
    volunteer,
  });
});