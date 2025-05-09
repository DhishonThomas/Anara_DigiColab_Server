import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"]
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
  verificationCode: Number,
  verificationCodeExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  this.password = await bcrypt.hash(this.password, 10);
});

adminSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

adminSchema.methods.generateToken = function () {
  return jwt.sign({ id: this._id }, process.env.ADMIN_SECRET_KEY
  )
};


adminSchema.methods.generateResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");
  

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

  return resetToken;
};




export const Admin = mongoose.model("admin", adminSchema);