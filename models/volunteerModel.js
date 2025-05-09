import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { type } from "os";

const volunteerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"]
  },

  guardian: {
    type: String,
    required: [true, "Guardian name is required"]
  },

  age: {
    type: Number,
    required: [true, "Age is required"]
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

  bankDocument: {
    type: String,
    required: [true, "Bank document is required"]
  },

  employmentStatus: {
    type: String,
    required: [true, "Employment status is required"],
    enum: ["Employed", "Un-employed"]
  },

  monthlyIncomeRange: {
    type: String,
    enum: ["Upto 20000", "20001 to 50000", "50001 and above"],
    required: function () {
      return this.employmentStatus === "Employed";
    }
  },


  educationQualification: {
    type: {
      degree: {
        type: String,
        required: [true, "Education qualification is required"],
        enum: ["Class XII", "Diploma", "Bachelor's", "Master's", "Ph.D.", "Other"]
      },
      yearOfCompletion: {
        type: Number,
        required: [true, "Year of completion is required"],
        min: [1900, "Year must be valid"],
        max: [new Date().getFullYear(), "Year cannot be in the future"]
      },
      certificate: {
        type: String,
        required: [true, "Certificate document is required"]
      }
    },
    required: [true, "Education qualification details are required"]
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

  accountVerified: {
    type: Boolean,
    default: false
  },

  verificationCode: Number,
  verificationCodeExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,

  createdAt: {
    type: Date,
    default: Date.now,
  },

  temp: {
    type: String
  },

  tempRegNumber: {
    type: String,
    unique: true
  },
  isBlocked:{
    type:Boolean,
    default:false
  },
  isPayment: {
    type:Boolean,
    default:false
  }
});

volunteerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  this.password = await bcrypt.hash(this.password, 10);
});

volunteerSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

volunteerSchema.methods.generateVerificationCode = function () {
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

volunteerSchema.methods.generateToken = function () {
  return jwt.sign({ id: this._id }, process.env.VOLUNTEER_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

volunteerSchema.methods.generateResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

  return resetToken;
};

export const Volunteer = mongoose.model("volunteer", volunteerSchema);