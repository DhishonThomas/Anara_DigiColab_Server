import { catchAsyncError } from "./catchAsyncError.js";
import ErrorHandler from "./error.js";
import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";

export const isAuthenticated = catchAsyncError(async (req, res, next) => {
  let token = req.cookies.token;

  if (!token && req.headers.authorization) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new ErrorHandler("User is not authenticated.", 400));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  req.user = await User.findById(decoded.id);

  next();
});

export const checkBlockedCandidate = async (req, res, next) => {
    try {
      const candidateId = req.user?.id; // assuming req.user is set by auth middleware
      if (!candidateId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
  
      const volunteer = await User.findById(candidateId);
      if (!volunteer) {
        return res.status(404).json({ message: 'Canditate not found' });
      }
  
      if (volunteer.isBlocked) {
        return res.status(403).json({ message: 'Access denied. Candidate is blocked.' });
      }
  
      next(); // continue to the next middleware or route
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  };