import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"]
  },
  guardian: {
    type: String,
    required: [true, "Guardian name is required"]
  },
  age: {
    type: Number
  },
  address: {
    type: String,
    required: [true, "Address is required"]
  },
  currentAddress: {
    type: String,
    required: [true, "Current Address is required"]
  },
  dob: {
    type: Date,
    required: [true, "Date of birth is required"]
  },
  gender: {
    type: String,
    required: [true, "Gender is required"],
    enum: ["Male", "Female", "Other"]
  },
  image: {
    type: String,
    required: [true, "Profile image is required"]
  },
  undertaking: {
    type: Boolean,
    default: false,
    required: [true, "Confirmation is required"]
  },
  policeVerification: {
    type: String,
  },
  educationQualification: {
    type: String,
    required: [true, "Education qualification is required"],
    enum: ["5th", "6th", "7th", "8th", "9th", "10th", "ITI"]
  },
  educationDocument: {
    type: String,
    required: [true, "Education qualification document is required"]
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minLength: [8, "Password must have at least 8 characters"],
    maxLength: [32, "Password cannot have more than 32 characters"],
    select: false
  },
  phone: {
    type: String,
    required: [true, "Phone number is required"],
    unique: true
  },
  bankAccNumber: {
    type: String,
    required: [true, "Bank account number is required"],
  },
  bankName: {
    type: String,
    required: [true, "Bank name is required"],
  },
  ifsc: {
    type: String,
    required: [true, "IFSC code is required"],
  },
  bankPassbook: {
    type: String,
    required: [true, "Bank passbook or bank statement document is required"],
  },
  volunteerRegNum: {
    type: String,
    required: [true, "Volunteer name is required"],
    ref: 'Volunteer'
  },
  accountVerified: {
    type: Boolean,
    default: false
  },
  pwdCategory: {
    type: String,
    required: true,
    enum: ["Yes", "No"],
  },
  pwdCertificate: {
    type: String,
    default: null,
  },
  entrepreneurshipInterest: {
    type: String,
    required: true,
    enum: ["Yes", "No"],
  },
  bplCertificate: {
    type: String,
    default: null,
  },
  verificationCode: Number,
  verificationCodeExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  temp: {
    type: String,
  },
  regNumber: {
    type: String,
    unique: true
  },
  cccCertified: {
    type: String,
    enum: ["Yes", "No", "Pending"],
    default: "Pending"
  },
  cccCertificate: {
    type: String,
    default: null
  },
  selectedCourse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
  },
  isBlocked: {
    type: Boolean,
    default: false
  }

});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.generateVerificationCode = function () {
  function generateRandomFiveDigitNumber() {
    const firstDigit = Math.floor(Math.random() * 9) + 1;
    const remainingDigits = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, 0);

    return parseInt(firstDigit + remainingDigits);
  }
  const verificationCode = generateRandomFiveDigitNumber();
  this.verificationCode = verificationCode;
  this.verificationCodeExpire = Date.now() + 10 * 60 * 1000;

  return verificationCode;
};

userSchema.methods.generateToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

userSchema.methods.generateResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

  return resetToken;
};

export const User = mongoose.model("User", userSchema);