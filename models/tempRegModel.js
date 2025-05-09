import mongoose from "mongoose";

const usertempRegSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  tempRegNumber: { type: String, required: true, unique: true },
});

export const userTempReg = mongoose.model("userTempReg", usertempRegSchema);

const volunteertempRegSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  tempRegNumber: { type:String, required:true, unique:true },
});

export const volunteerTempReg = mongoose.model("volunteerTempReg", volunteertempRegSchema);