import mongoose from 'mongoose';

const pdfFileSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true,
    },
    cloudinary_url: {
        type: String,
        required: true,
    },
    public_id: {
        type: String,   // Cloudinary's unique ID for the uploaded file
        required: true,
    },
    letter_head_id: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const PDFFile = mongoose.model('PDFFile', pdfFileSchema);

export default PDFFile;
