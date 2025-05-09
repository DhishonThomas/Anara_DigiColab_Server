import { Admin } from "../models/adminModel.js";
import { catchAsyncError } from "./catchAsyncError.js";
import ErrorHandler from "./error.js";
import jwt from "jsonwebtoken";

export const isAdminAuthenticated = catchAsyncError(async (req, res, next) => {
  let token = req.cookies.token;

  if (!token && req.headers.authorization) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new ErrorHandler("Admin is not authenticated.", 400));
  }

  const decoded = jwt.verify(token, process.env.ADMIN_SECRET_KEY);
  req.user = await Admin.findById(decoded.id);

  next();
});