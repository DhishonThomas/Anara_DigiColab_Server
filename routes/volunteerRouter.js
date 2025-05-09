import express from "express";
import {
  register,
  sendEmailOTP,
  verifyEmailOTP,
  login,
  logout,
  forgotPassword,
  resetPassword,
  // generateTemporaryRegNumber,
  // approveEmail,
  getVolunteer,
  getUsersUnderVolunteer
} from "../controllers/volunteerController.js";
import { isVolunteerAuthenticated } from "../middlewares/authVolunteer.js";
import { upload } from "../multer/upload.js";

const router = express.Router();

router.post("/send-email-otp", sendEmailOTP); //OTP for email verification

router.post("/verify-email-otp", verifyEmailOTP); //Verify OTP for email verification

// router.post("/generate-temp-reg", generateTemporaryRegNumber); //Generate temporary registration number

// router.get('/approve', approveEmail) //Approve email

router.post("/register", upload.fields([
  { name: "image", maxCount: 1 },
  { name: "undertaking", maxCount: 1 },
  { name: "policeVerification", maxCount: 1 },
  { name: "educationCertificate", maxCount: 1 },
  { name: "bankDocument", maxCount: 1 },
]), register); //Register user with image upload

router.post("/login", login); //Login user


router.get("/logout", isVolunteerAuthenticated, logout); //Logout user

router.get("/me", isVolunteerAuthenticated, getVolunteer); //Get user information

router.post("/forgot-password", forgotPassword); //Forgot password

router.put("/reset-password/:token", resetPassword); //Reset password with token

router.get("/usersdetails",isVolunteerAuthenticated, getUsersUnderVolunteer);

export default router;