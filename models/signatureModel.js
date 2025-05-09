import mongoose from "mongoose";

const signatureSchema = new mongoose.Schema({
  
  userId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  public_id: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const Signature = mongoose.model("Signature", signatureSchema);
