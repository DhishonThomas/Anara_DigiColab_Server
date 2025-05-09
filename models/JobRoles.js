import mongoose from 'mongoose';

const JobRoleSchema = new mongoose.Schema({
  name: {
    type: String,
   
  },
  description: {
    type: String,
  },
  courses: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
    },
  ],
});

export const JobRole = mongoose.model('JobRole', JobRoleSchema);
