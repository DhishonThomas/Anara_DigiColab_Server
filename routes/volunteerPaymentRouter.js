import express from 'express';
import { createPaymentRequest, getVolunteerPaymentRequests } from '../controllers/volunteerPaymentController.js';
import { isVolunteerAuthenticated, checkBlockedVolunteer } from "../middlewares/authVolunteer.js";

const router = express.Router();

router.post('/request', isVolunteerAuthenticated,checkBlockedVolunteer, createPaymentRequest); //Create request 

router.get('/my-requests', isVolunteerAuthenticated,checkBlockedVolunteer, getVolunteerPaymentRequests); //My requests

export default router;