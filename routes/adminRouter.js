import express from "express";
import {
  register,
  login,
  logout,
  getadmin,
  forgotPassword,
  resetPassword,
  CountVolunteersAndUsers,
  getAllVolunteers,
  getAllUsers,
  getCandidateCountPerVolunteer,
  getVolunteerWithUsers,
  toggleVolunteerBlock,
  getUserByRegNumber,
  toggleUserBlock,
  createCourse,
  getCourses,
  deleteCourse,
  createJobRole,
  getJobRoles,
  deleteJobRole,
  updateCourse
} from "../controllers/adminController.js";
import { isAdminAuthenticated } from "../middlewares/authAdmin.js";
import multer from "multer";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/register", register);  // Admin register

router.post("/login", login); // admin login page

router.get("/logout", isAdminAuthenticated, logout); // logout button

router.get("/me", isAdminAuthenticated, getadmin); // get admin data

router.post("/password/forgot", forgotPassword); //Admin forgot password

router.put("/password/reset/:token", resetPassword); //Admin reset password

router.get("/volunteers", isAdminAuthenticated, getAllVolunteers) //Get all volunteers and users

router.get("/users", isAdminAuthenticated, getAllUsers) //Get all volunteers and users

router.get("/count", isAdminAuthenticated, CountVolunteersAndUsers) //Count of volunteer and users

router.get("/volunteer-candidate-count", isAdminAuthenticated, getCandidateCountPerVolunteer); //Get Candidate Count Per Volunteer

router.get("/volunteer/:regNumber", isAdminAuthenticated, getVolunteerWithUsers); //Get Volunteer With Users

router.put("/volunteer/block/:regNumber", isAdminAuthenticated, toggleVolunteerBlock); //Toggle Volunteer Block

router.get("/user/:regNumber", isAdminAuthenticated, getUserByRegNumber); //Get User By RegNumber

router.put("/users/block/:regNumber", isAdminAuthenticated, toggleUserBlock); //Toggle User Block

// Course role routes
router.post("/courses", isAdminAuthenticated, upload.fields([{ name: 'image', maxCount: 1 }]), createCourse); // create course

router.put("/edit-courses/:id", isAdminAuthenticated, upload.fields([{ name: 'image', maxCount: 1 }]), updateCourse); // Update course

router.get("/courses", isAdminAuthenticated, getCourses); // Get course

router.delete("/courses/:id", isAdminAuthenticated, deleteCourse); // Delete course

// Job role routes
router.post("/jobroles", isAdminAuthenticated, createJobRole); //Create job-roles

router.get("/jobroles", isAdminAuthenticated, getJobRoles); //Get job-roles

router.delete("/jobroles/:id", isAdminAuthenticated, deleteJobRole); //Delete job-roles





export default router;