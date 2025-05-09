import mongoose from 'mongoose';

const CourseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Course title is required"],
  },
  description: {
    type: String,
    required: [true, "Course description is required"],
  },
  image: {
    type: String,
    required: [true, "Course image is required"],
  },
  qualifications: {
    type: String,
    required: [true, "Education qualification is required"],
    enum: ["5th", "6th", "7th", "8th", "9th", "10th", "ITI"]
  }
}, {
  timestamps: true
});

export const Course = mongoose.model('Course', CourseSchema);
