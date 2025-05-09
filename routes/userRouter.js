import express from "express";
import {
  register,
  sendEmailOTP,
  verifyEmailOTP,
  login,
  logout,
  getUser,
  forgotPassword,
  resetPassword,
  updateCCCStatus,
  checkCCCStatus,
  checkCourseSelection,
  updateCourses,
  searchCourses,
  selectCourse,
  getCoursesForUser,
} from "../controllers/userController.js";
import { isAuthenticated } from "../middlewares/auth.js";
import { upload } from "../multer/upload.js";

const router = express.Router();

router.post("/send-email-otp", sendEmailOTP); //OTP for email verification

router.post("/verify-email-otp", verifyEmailOTP); //Verify OTP for email verification

router.post(
  "/register",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "undertaking", maxCount: 1 },
    { name: "policeVerification", maxCount: 1 },
    { name: "educationDocument", maxCount: 1 },
    { name: "bankPassbook", maxCount: 1 },
    { name: "pwdCertificate", maxCount: 1 },
    { name: "bplCertificate", maxCount: 1 },
  ]),
  register
); //Register user with image upload
router.post("/login", login); //Login user

router.get("/logout", isAuthenticated, logout); //Logout user

router.get("/me", isAuthenticated, getUser); //Get user information

router.post("/forgot-password", forgotPassword); //Forgot password

router.put("/reset-password/:token", resetPassword); //Reset password with token

// ----Dashboard-----
router.post("/update-ccc-status", isAuthenticated,upload.fields([{ name: "cccCertificate", maxCount: 1 }]),updateCCCStatus); //Update CCC status with certificate upload

router.get('/ccc-status', isAuthenticated, checkCCCStatus); //Get CCC status

router.get("/courses", isAuthenticated,getCoursesForUser); //Courses

router.get("/search-courses",isAuthenticated, searchCourses); //Search courses

router.post("/select", isAuthenticated,selectCourse); //Select course

router.post("/update-job-courses", isAuthenticated, updateCourses); //Update job-roles and course

router.get("/course-selection", isAuthenticated, checkCourseSelection); //Check course selection



export default router;

