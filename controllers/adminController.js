import ErrorHandler from "../middlewares/error.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { Admin } from "../models/adminModel.js";
import { sendEmail } from "../utils/sendEmail.js";
import { adminToken } from "../utils/adminToken.js";
import crypto from "crypto";
import { User } from "../models/userModel.js";
import { Volunteer } from "../models/volunteerModel.js";
import { JobRole } from "../models/JobRoles.js";
import { Course } from "../models/Course.js";
import { cloudinaryInstance } from "../config/cloudinary.js";
import streamifier from "streamifier";

//Register
export const register = catchAsyncError(async (req, res, next) => {
  const { name, email, phone, password } = req.body;
  console.log("Request received:", req.body);

  if (!name || !email || !phone || !password) {
    return next(new ErrorHandler("All fields are required.", 400));
  }

  function validatePhoneNumber(phone) {
    const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  if (!validatePhoneNumber(phone)) {
    return next(new ErrorHandler("Invalid phone number.", 400));
  }

  const existingAdmin = await Admin.findOne({
    $or: [{ email }, { phone }],
  });

  if (existingAdmin) {
    return next(new ErrorHandler("Phone or Email is already used.", 400));
  }

  const registrationAttemptsByAdmin = await Admin.countDocuments({
    $or: [{ phone }, { email }],
  });

  if (registrationAttemptsByAdmin > 3) {
    return next(
      new ErrorHandler(
        "You have exceeded the maximum number of attempts (3). Please try again after an hour.",
        400
      )
    );
  }

  const newAdmin = await Admin.create({ name, email, phone, password });

  res.status(201).json({
    success: true,
    message: "Admin registered successfully",
    admin: newAdmin,
  });
});





//Login
export const login = catchAsyncError(async (req, res, next) => {
  console.log(req.body);

  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ErrorHandler("Email and password are required.", 400));
  }

  const admin = await Admin.findOne({ email }).select("+password");
  if (!admin) {
    return next(new ErrorHandler("Invalid email or password.", 400));
  }

  const isPasswordMatched = await admin.comparePassword(password);
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password.", 400));
  }

  adminToken(admin, 200, "admin logged in successfully.", res);
});





//Logout
export const logout = catchAsyncError(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", "", {
      expires: new Date(Date.now()),
      httpOnly: true,
    })
    .json({
      success: true,
      message: "Logged out successfully.",
    });
});




//GetAdmin
export const getadmin = catchAsyncError(async (req, res, next) => {
  const admin = req.admin;
  res.status(200).json({
    success: true,
    admin
  });
});






//Forgot Password
export const forgotPassword = catchAsyncError(async (req, res, next) => {
  const admin = await Admin.findOne({
    email: req.body.email,
  });

  if (!admin) {
    return next(new ErrorHandler("Admin not found.", 404));
  }

  // Generate reset password token
  const resetToken = admin.generateResetPasswordToken();
  await admin.save({ validateBeforeSave: false });

  // Create reset password URL
  const resetPasswordUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;

  // Message to be sent to the user
  const message = `Your Reset Password Token is: \n\n ${resetPasswordUrl} \n\n If you did not request this, please ignore this email.`;

  try {
    // Send email
    await sendEmail({
      email: admin.email,
      subject: "MERN Authentication App - Reset Password",
      message,
    });

    res.status(200).json({
      success: true,
      message: `Reset password email sent to ${admin.email}.`,
    });
  } catch (error) {
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpire = undefined;
    await admin.save({ validateBeforeSave: false });
    return next(new ErrorHandler("Cannot send reset password token.", 500));
  }
});





//Reset Password
export const resetPassword = catchAsyncError(async (req, res, next) => {
  const { token } = req.params;

  if (!token) {
    return next(new ErrorHandler("Token is missing.", 400));
  }

  // Hash the token from the URL to match with the stored token in the database
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const admin = await Admin.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }, // Ensure token has not expired
  });

  if (!admin) {
    return next(new ErrorHandler("Reset password token is invalid or has expired.", 400));
  }

  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    return next(new ErrorHandler("Password and confirm password are required.", 400));
  }

  if (password !== confirmPassword) {
    return next(new ErrorHandler("Passwords do not match.", 400));
  }

  // Update password and remove reset token from database
  admin.password = password;
  admin.resetPasswordToken = undefined;
  admin.resetPasswordExpire = undefined;

  await admin.save();

  // Send success response and token
  adminToken(admin, 200, "Password reset successfully.", res);
});





//Get all volunteers in Admin Dashboard
export const getAllVolunteers = catchAsyncError(async (req, res, next) => {
  try {
    const volunteers = await Volunteer.find({});

    const volunteerData = await Promise.all(
      volunteers.map(async (volunteer) => {
        const userCount = await User.countDocuments({ volunteerRegNum: volunteer.tempRegNumber });

        return {
          volunteerDetails: {
            _id: volunteer._id,
            name: volunteer.name,
            tempRegNumber: volunteer.tempRegNumber,
            isBlocked: volunteer.isBlocked,
            email: volunteer.email
            // Add more fields as needed
          },
          userCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      totalVolunteers: volunteers.length,
      data: volunteerData,
    });
  } catch (error) {
    return next(new ErrorHandler("Failed to fetch volunteers.", 500));
  }
});







//Get all users in Admin Dashboard
export const getAllUsers = catchAsyncError(async (req, res, next) => {
  try {
    const users = await User.find({}); // Add filter if needed

    const userData = await Promise.all(
      users.map(async (user) => {
        // Get volunteer if you want to populate volunteer info
        const volunteer = await Volunteer.findOne({ tempRegNumber: user.volunteerRegNum });

        return {
          userDetails: {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            accountVerified: user.accountVerified,
            regNumber: user.regNumber,
            isBlocked: user.isBlocked,
            createdAt: user.createdAt,
            // Add more user fields as needed
          },
          volunteerInfo: volunteer
            ? {
              name: volunteer.name,
              email: volunteer.email,
            }
            : null,
        };
      })
    );

    res.status(200).json({
      success: true,
      totalUsers: users.length,
      data: userData,
    });
  } catch (error) {
    return next(new ErrorHandler("Failed to fetch users.", 500));
  }
});





// Count of users and volunteers
export const CountVolunteersAndUsers = catchAsyncError(async (req, res, next) => {
  try {
    // Get count of volunteers
    const volunteerCount = await Volunteer.countDocuments();

    // Get count of users
    const userCount = await User.countDocuments();

    // Return the counts
    res.status(200).json({
      success: true,
      volunteerCount,
      userCount,
    });
  } catch (error) {
    return next(new ErrorHandler("Failed to fetch volunteer and user counts.", 500));
  }
});





//Get candidates count per volunteer
export const getCandidateCountPerVolunteer = catchAsyncError(async (req, res, next) => {
  try {
    const aggregation = await User.aggregate([
      {
        $group: {
          _id: "$volunteerRegNum",
          candidateCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "volunteers",
          localField: "_id", // volunteerRegNum from User
          foreignField: "tempRegNumber", // match with Volunteer.regNumber
          as: "volunteerDetails",
        },
      },
      {
        $unwind: {
          path: "$volunteerDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          volunteerRegNumber: "$_id",
          candidateCount: 1,
          volunteerName: "$volunteerDetails.name",
          volunteerEmail: "$volunteerDetails.email",
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: aggregation,
    });
  } catch (error) {
    return next(new ErrorHandler("Failed to fetch candidate count per volunteer.", 500));
  }
});





//Get volunteers with users
export const getVolunteerWithUsers = catchAsyncError(async (req, res, next) => {
  try {
    const { regNumber } = req.params;

    // Step 1: Find the volunteer using tempRegNumber
    const volunteer = await Volunteer.findOne({ tempRegNumber: regNumber });

    if (!volunteer) {
      return next(new ErrorHandler("Volunteer not found", 404));
    }

    // Step 2: Find all users registered under this volunteer's regNumber
    const users = await User.find({ volunteerRegNum: volunteer.tempRegNumber });

    // Step 3: Return response with volunteer and users
    res.status(200).json({
      success: true,
      volunteerDetails: volunteer,
      registeredUsers: users,
      userCount: users.length,
    });

  } catch (error) {
    return next(new ErrorHandler("Failed to fetch volunteer and users.", 500));
  }
});





//Toggle volunteer block
export const toggleVolunteerBlock = catchAsyncError(async (req, res, next) => {
  try {
    const { regNumber } = req.params;      // regNumber from URL
    const { block } = req.body;            // true to block, false to unblock

    const volunteer = await Volunteer.findOne({ tempRegNumber: regNumber });

    if (!volunteer) {
      return next(new ErrorHandler("Volunteer not found", 404));
    }

    // Update block status based on request
    volunteer.isBlocked = block;
    await volunteer.save();

    // Send response based on the block status
    const action = block ? 'blocked' : 'unblocked';
    res.status(200).json({
      success: true,
      message: `Volunteer has been ${action} successfully.`,
    });
  } catch (error) {
    return next(new ErrorHandler("Failed to update volunteer block status.", 500));
  }
});





//Get user by reg num
export const getUserByRegNumber = catchAsyncError(async (req, res, next) => {
  try {
    const { regNumber } = req.params;

    const user = await User.findOne({ regNumber });

    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    res.status(200).json({
      success: true,
      user,
    });

  } catch (error) {
    return next(new ErrorHandler("Failed to fetch user details.", 500));
  }
});





//Toggle user block
export const toggleUserBlock = catchAsyncError(async (req, res, next) => {
  try {
    const { regNumber } = req.params;     // regNumber from URL
    const { block } = req.body;           // true to block, false to unblock

    const user = await User.findOne({ regNumber });

    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    // Update block status
    user.isBlocked = block;
    await user.save();

    const action = block ? 'blocked' : 'unblocked';
    res.status(200).json({
      success: true,
      message: `User has been ${action} successfully.`,
    });

  } catch (error) {
    return next(new ErrorHandler("Failed to update user block status.", 500));
  }
});



//-------Job-roles----------------


// Create a job role
export const createJobRole = catchAsyncError(async (req, res, next) => {
  const { name, description } = req.body;

  if (!name || !description) {
    return next(new ErrorHandler("Name and description are required.", 400));
  }

  const jobRole = await JobRole.create({ name, description });

  res.status(201).json({
    success: true,
    message: "Job role created successfully",
    jobRole
  });
});




// Get all job roles with course details
export const getJobRoles = catchAsyncError(async (req, res, next) => {
  const roles = await JobRole.find().populate('courses');
  res.status(200).json({ success: true, roles });
});




// Delete job role 
export const deleteJobRole = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    const jobRole = await JobRole.findById(id);
    if (!jobRole) {
      return next(new ErrorHandler("Job role not found", 404));
    }

    const associatedCourses = jobRole.courses || [];

    await JobRole.findByIdAndDelete(id);

    for (const courseId of associatedCourses) {
      const otherJobRolesWithThisCourse = await JobRole.countDocuments({
        _id: { $ne: id },
        courses: courseId
      });

      if (otherJobRolesWithThisCourse === 0) {
        await Course.findByIdAndDelete(courseId);
      }
    }

    res.status(200).json({
      success: true,
      message: "Job role and its exclusive courses deleted successfully"
    });
  } catch (error) {
    return next(new ErrorHandler(`Failed to delete job role: ${error.message}`, 500));
  }
});





//-------Courses----------------

export const uploadToCloudinary = (buffer, folder, resourceType = "auto") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinaryInstance.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// Create a course
export const createCourse = catchAsyncError(async (req, res, next) => {
  const { title, description, jobRoles, qualifications } = req.body;

  if (!title || !description) {
    return next(new ErrorHandler("Title and description are required.", 400));
  }

  if (!req.files || !req.files.image) {
    return next(new ErrorHandler("Course image is required.", 400));
  }

  try {
    const image = await uploadToCloudinary(req.files.image[0].buffer, "courses");
    const course = await Course.create({ title, description, image, qualifications });

    if (jobRoles && jobRoles.length > 0) {
      await JobRole.updateMany(
        { _id: { $in: jobRoles } },
        { $addToSet: { courses: course._id } }
      );
    }

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      course
    });
  } catch (error) {
    console.log(error);
    return next(new ErrorHandler("Failed to create course.", 500));
  }
});




//Update course
export const updateCourse = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { title, description, jobRoles, qualifications } = req.body;

  const course = await Course.findById(id);
  if (!course) {
    return next(new ErrorHandler("Course not found", 404));
  }

  if (title) course.title = title;
  if (description) course.description = description;
  if (qualifications) course.qualifications = qualifications;

  if (req.files && req.files.image) {
    try {
      const url = course.image;
      const public_id = url.split('/').slice(-2).join('/').split('.')[0]; // signatures/sample-image
      await cloudinaryInstance.uploader.destroy(public_id);
      const image = await uploadToCloudinary(req.files.image[0].buffer, "courses");
      course.image = image;
    } catch (error) {
      console.log(error);
      return next(new ErrorHandler("Failed to upload image.", 500));
    }
  }

  await course.save();

  if (jobRoles !== undefined) {
    await JobRole.updateMany(
      { courses: course._id },
      { $pull: { courses: course._id } }
    );

    if (jobRoles && jobRoles.length > 0) {
      await JobRole.updateMany(
        { _id: { $in: jobRoles } },
        { $addToSet: { courses: course._id } }
      );
    }
  }

  res.status(200).json({
    success: true,
    message: "Course updated successfully",
  });
});




// Get all courses with job roles
export const getCourses = catchAsyncError(async (req, res, next) => {
  try {
    const courses = await Course.find().lean();
    const jobRoles = await JobRole.find().populate('courses').lean();
    const courseToJobRolesMap = {};

    jobRoles.forEach(role => {
      role.courses.forEach(course => {
        if (!courseToJobRolesMap[course._id]) {
          courseToJobRolesMap[course._id] = [];
        }
        courseToJobRolesMap[course._id].push({
          roleId: role._id,
          roleName: role.name,
          roleDescription: role.description
        });
      });
    });

    const enhancedCourses = courses.map(course => {
      return {
        ...course,
        jobRoles: courseToJobRolesMap[course._id] || []
      };
    });

    res.status(200).json({
      success: true,
      courses: enhancedCourses,
      jobRoles: jobRoles.map(role => ({
        _id: role._id,
        name: role.name,
        description: role.description,
        courses: role.courses.map(course => ({
          _id: course._id,
          title: course.title,
          description: course.description,
          image: course.image
        }))
      }))
    });
  } catch (error) {
    return next(new ErrorHandler("Failed to fetch courses and job roles.", 500));
  }
});





// Delete a course
export const deleteCourse = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  // Find the course
  const course = await Course.findById(id);
  if (!course) {
    return next(new ErrorHandler("Course not found", 404));
  }
  const url = course.image;
  const public_id = url.split('/').slice(-2).join('/').split('.')[0]; // signatures/sample-image

  await cloudinaryInstance.uploader.destroy(public_id);
  
  // Remove this course from all job roles that have it
  await JobRole.updateMany(
    { courses: course._id },
    { $pull: { courses: course._id } }
  );

  // Delete the course
  await Course.findByIdAndDelete(id);
  res.status(200).json({
    success: true,
    message: "Course deleted successfully"
  });
});