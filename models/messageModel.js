// models/SentMessage.js
import mongoose from "mongoose";

const sentMessageSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  cloudinaryUrl: {
    type: String,
    required: true,
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
});

const SentMessage = mongoose.model("SentMessage", sentMessageSchema);

export default SentMessage;
