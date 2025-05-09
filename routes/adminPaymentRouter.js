import express from 'express';
import {
    getAllPaymentRequests,
    approvePaymentRequest,
    rejectPaymentRequest,
    markAsPaid
} from '../controllers/adminPaymentController.js';
import { isAdminAuthenticated } from "../middlewares/authAdmin.js";

const router = express.Router();

router.get('/all', isAdminAuthenticated, getAllPaymentRequests); //All payment request

router.patch('/approve/:requestId', isAdminAuthenticated, approvePaymentRequest); //Approve request

router.patch('/reject/:requestId', isAdminAuthenticated, rejectPaymentRequest); //Reject request

router.patch('/mark-paid/:requestId', isAdminAuthenticated, markAsPaid); //Mark paid

export default router;