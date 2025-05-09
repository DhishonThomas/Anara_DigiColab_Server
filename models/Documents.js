// models/Documents.js
import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  file_name: {
    type: String,
    required: true,
  },
  file_link: {
    type: String,
    required: true,
  },
  public_id: {
    type: String,
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

export const Document = mongoose.model("Document", documentSchema);
