import mongoose from 'mongoose';

const paymentRequest = new mongoose.Schema({
    volunteer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'volunteer',
        required: true
    },
    volunteerRegNumber: {
        type: String,
        required: true
    },
    userCount: {
        type: Number,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'paid'],
        default: 'pending'
    },
    approvals: [{
        admin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'admin'
        },
        approvedAt: {
            type: Date,
            default: Date.now
        }
    }],
    razorpayPaymentId: {
        type: String
    },
    razorpayOrderId: {
        type: String
    },
    paymentDate: {
        type: Date
    },
    requestDate: {
        type: Date,
        default: Date.now
    }
});


//Calculate payment amount based on user count
paymentRequest.pre("save",function(next){
    if(!this.isModified("userCount")) return next();

    if(this.userCount <=50) {
        this.amount = 50;
    } else if(this.userCount <=200) {
        this.amount = 75;
    } else {
        this.amount = 100;
    }
    next();
});

export const PaymentRequest = mongoose.model("paymentRequest", paymentRequest)