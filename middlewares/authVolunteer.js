import { catchAsyncError } from "./catchAsyncError.js";
import ErrorHandler from "./error.js";
import jwt from "jsonwebtoken";
import { Volunteer } from '../models/volunteerModel.js';

export const isVolunteerAuthenticated = catchAsyncError(async (req, res, next) => {
    let token = req.cookies.token;
  
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
  
    if (!token) {
      return next(new ErrorHandler("Volunteer is not authenticated.", 400));
    }
  
    const decoded = jwt.verify(token, process.env.VOLUNTEER_SECRET_KEY);
    req.user = await Volunteer.findById(decoded.id);
  
    next();
  });


  export const checkBlockedVolunteer = async (req, res, next) => {
    try {
      const volunteerId = req.user?.id; // assuming req.user is set by auth middleware
      if (!volunteerId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
  
      const volunteer = await Volunteer.findById(volunteerId);
      if (!volunteer) {
        return res.status(404).json({ message: 'Volunteer not found' });
      }
  
      if (volunteer.isBlocked) {
        return res.status(403).json({ message: 'Access denied. Volunteer is blocked.' });
      }
  
      next(); // continue to the next middleware or route
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  };