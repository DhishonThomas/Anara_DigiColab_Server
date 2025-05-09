import mongoose from "mongoose";

const letterHeadSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, "Subject is required"]
  },
  body_text: {
    type: String,
    required: [true, "Body text is required"]
  },
  image_id: {
    type: String,
    ref: 'Document', // or another image model you use
    required: false
  },
  public_id: {
    type: [Object],
    required: [true, "Public id is required"]
  },
  file_link: {
    type: [Object],
    required: [true, "File link is required"]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const LetterHead = mongoose.model("LetterHead", letterHeadSchema);
