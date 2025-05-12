import express from 'express';
import { editLetterheadPDF, generateLetterheadPDF, sendMail, getSentMessages, getLetterHeads } from '../controllers/letterheadPdfController.js';
import { isAdminAuthenticated } from '../middlewares/authAdmin.js';

const router = express.Router();


router.post('/generatepdf', isAdminAuthenticated, generateLetterheadPDF);
router.put('/editpdf/:id', isAdminAuthenticated, editLetterheadPDF);
router.post('/send-mail',isAdminAuthenticated, sendMail);
router.post('/list-sent-messages',isAdminAuthenticated, getSentMessages);
router.post('/list-letterheads',isAdminAuthenticated, getLetterHeads);


export default router;
