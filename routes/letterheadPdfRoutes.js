import express from 'express';
import { editLetterheadPDF, generateLetterheadPDF } from '../controllers/letterheadPdfController.js';
import { isAdminAuthenticated } from '../middlewares/authAdmin.js';

const router = express.Router();


router.post('/generatepdf', isAdminAuthenticated, generateLetterheadPDF);
router.put('/editpdf/:id', isAdminAuthenticated, editLetterheadPDF);

export default router;
