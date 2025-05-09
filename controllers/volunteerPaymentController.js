import { PaymentRequest } from '../models/paymentModel.js';
import { Volunteer } from '../models/volunteerModel.js';

export const createPaymentRequest = async (req, res) => {
    try {
        const volunteerId = req.volunteer.id; 

        // Find the volunteer to get their registration number
        const volunteer = await Volunteer.findById(volunteerId);
        if (!volunteer) {
            return res.status(404).json({ message: 'Volunteer not found' });
        }

        // Create a new payment request
        const newPaymentRequest = new PaymentRequest({
            volunteer: volunteerId,
            volunteerRegNumber: volunteer.tempRegNumber,
            userCount: req.body.userCount,
            amount: req.body.amount,
        });

        await newPaymentRequest.save();

        return res.status(201).json({
            success: true,
            message: 'Payment request created successfully',
            paymentRequest: newPaymentRequest
        });
    } catch (error) {
        console.error('Error creating payment request:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create payment request',
            error: error.message
        });
    }
};

export const getVolunteerPaymentRequests = async (req, res) => {
    try {
        const volunteerId = req.volunteer.id;

        const paymentRequests = await PaymentRequest.find({ volunteer: volunteerId })
            .sort({ requestDate: -1 });

        return res.status(200).json({
            success: true,
            count: paymentRequests.length,
            paymentRequests
        });
    } catch (error) {
        console.error('Error fetching payment requests:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch payment requests',
            error: error.message
        });
    }
};