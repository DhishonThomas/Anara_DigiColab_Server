import { PaymentRequest } from '../models/paymentModel.js';

export const getAllPaymentRequests = async (req, res) => {
    try {
        const { status } = req.query;

        const query = status ? { status } : {};

        const paymentRequests = await PaymentRequest.find(query)
            .populate('volunteer', 'name email registrationNumber')
            .populate('approvals.admin', 'name email')
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

export const approvePaymentRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const adminId = req.admin.id;

        const paymentRequest = await PaymentRequest.findById(requestId);

        if (!paymentRequest) {
            return res.status(404).json({ message: 'Payment request not found' });
        }

        // Check if admin has already approved this request
        const alreadyApproved = paymentRequest.approvals.some(
            approval => approval.admin.toString() === adminId
        );

        if (alreadyApproved) {
            return res.status(400).json({
                success: false,
                message: 'You have already approved this request'
            });
        }

        // Add this admin's approval
        paymentRequest.approvals.push({ admin: adminId });

        // Check if we have at least 3 approvals now
        if (paymentRequest.approvals.length >= 3 && paymentRequest.status === 'pending') {
            paymentRequest.status = 'approved';
        }

        await paymentRequest.save();

        return res.status(200).json({
            success: true,
            message: paymentRequest.status === 'approved'
                ? 'Payment request has been approved with required approvals'
                : `Payment request approval recorded (${paymentRequest.approvals.length}/3 approvals)`,
            paymentRequest
        });
    } catch (error) {
        console.error('Error approving payment request:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to approve payment request',
            error: error.message
        });
    }
};

export const rejectPaymentRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const adminId = req.admin.id;

        const paymentRequest = await PaymentRequest.findById(requestId);

        if (!paymentRequest) {
            return res.status(404).json({ message: 'Payment request not found' });
        }

        if (paymentRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot reject request with status: ${paymentRequest.status}`
            });
        }

        // Update status to rejected
        paymentRequest.status = 'rejected';
        // Add a rejection note if provided
        if (req.body.rejectionReason) {
            paymentRequest.rejectionReason = req.body.rejectionReason;
        }

        await paymentRequest.save();

        return res.status(200).json({
            success: true,
            message: 'Payment request has been rejected',
            paymentRequest
        });
    } catch (error) {
        console.error('Error rejecting payment request:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to reject payment request',
            error: error.message
        });
    }
};

export const markAsPaid = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { razorpayPaymentId, razorpayOrderId } = req.body;

        const paymentRequest = await PaymentRequest.findById(requestId);

        if (!paymentRequest) {
            return res.status(404).json({ message: 'Payment request not found' });
        }

        if (paymentRequest.status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: 'Only approved payment requests can be marked as paid'
            });
        }

        // Update payment details
        paymentRequest.status = 'paid';
        paymentRequest.razorpayPaymentId = razorpayPaymentId;
        paymentRequest.razorpayOrderId = razorpayOrderId;
        paymentRequest.paymentDate = Date.now();

        await paymentRequest.save();

        return res.status(200).json({
            success: true,
            message: 'Payment request has been marked as paid',
            paymentRequest
        });
    } catch (error) {
        console.error('Error marking payment as paid:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to mark payment as paid',
            error: error.message
        });
    }
};