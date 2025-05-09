import express from 'express';
import { createPaymentRequest, getVolunteerPaymentRequests } from '../controllers/volunteerPaymentController.js';
import { isVolunteerAuthenticated } from "../middlewares/authVolunteer.js";

const router = express.Router();

router.post('/request', isVolunteerAuthenticated, createPaymentRequest); //Create request 

router.get('/my-requests', isVolunteerAuthenticated, getVolunteerPaymentRequests); //My requests

export default router;