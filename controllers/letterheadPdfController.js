import puppeteer from 'puppeteer';
import { cloudinaryInstance } from "../config/cloudinary.js";
import PDFFile from '../models/pdfFile.js';
import fs from 'fs/promises';
import path from 'path';
import nodemailer from "nodemailer";
import axios from "axios";
import SentMessage from "../models/messageModel.js";
import { LetterHead } from '../models/letterHeadModel.js';

export const generateLetterheadPDF = async (req, res) => {
    console.log("📝 PDF Generation triggered");
    
    try {
        const { htmlContent, subject, letterHeadId } = req.body;
        
        if (!htmlContent) {
            return res.status(400).json({ error: "HTML content is required" });
        }
        
        // Launch Puppeteer
        const browser = await puppeteer.launch({
            headless: "new", // or `true` depending on Puppeteer version
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        // Generate PDF buffer
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();
        
        // 1. Check if PDF buffer is empty
        if (!pdfBuffer || pdfBuffer.length === 0) {
          throw new Error("Generated PDF buffer is empty");
        }
        
        // 2. Save PDF to local temp path
        const tmpDir = path.resolve('./tmp');
        await fs.mkdir(tmpDir, { recursive: true });

        const tempPath = path.join(tmpDir, `${Date.now()}-letterhead.pdf`);
        await fs.writeFile(tempPath, pdfBuffer);

        // 3. Upload to Cloudinary
        const uploadResult = await cloudinaryInstance.uploader.upload(tempPath, {
            resource_type: "raw", // raw for non-image like PDF
            folder: "letterheads",
        });
  
        // 4. Delete local temp file
        await fs.unlink(tempPath);
      

        // Store PDF metadata in the database
        const pdfRecord = await PDFFile.create({
            subject,             // Subject of the letterhead
            cloudinary_url: uploadResult.secure_url,  // URL of the uploaded PDF
            public_id: uploadResult.public_id,  // Cloudinary's unique public ID
            letter_head_id:letterHeadId
        });

        // Return the PDF URL in the response
        res.status(201).json({ message: 'PDF generated', url: uploadResult.secure_url });
        // res.status(201).json({ message: 'PDF generated', url: tempPath });
    } catch (err) {
        console.error("❌ PDF Generation Error:", err);
        res.status(500).json({ error: "Failed to generate PDF" });
    }
};

export const editLetterheadPDF = async (req, res) => {
    console.log("✏️ PDF Edit triggered");
    
    try {
        const { id } = req.params;
        const { htmlContent, subject } = req.body;
        
        console.log(`Editing PDF with ID: ${id}`);
        console.log(`Subject: ${subject}`);
        
        if (!htmlContent) {
            return res.status(400).json({ error: "HTML content is required" });
        }
        
        // Verify the PDF exists in the database
        const existingPDF = await PDFFile.findById(id);
        if (!existingPDF) {
            return res.status(404).json({ error: "PDF not found" });
        }
        
        console.log(`Found existing PDF with public_id: ${existingPDF.public_id}`);
        
        // Launch Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        // Generate new PDF buffer
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        
        await browser.close();
        
        // Ensure tmp directory exists
        const tmpDir = path.resolve('./tmp');
        await fs.mkdir(tmpDir, { recursive: true });
        
        // Save PDF to temp file
        const tempPath = path.join(tmpDir, `${Date.now()}_edit.pdf`);
        await fs.writeFile(tempPath, pdfBuffer);
        
        // Delete the old PDF from Cloudinary
        // if (existingPDF.public_id) {
        //     console.log(`Attempting to delete Cloudinary file with public_id: ${existingPDF.public_id}`);
        //     await cloudinaryInstance.uploader.destroy(existingPDF.public_id, { resource_type: "raw" });
        // } else {
        //     console.log("No public_id found for existing PDF, skipping Cloudinary delete");
        // }
        
        // Upload new PDF to Cloudinary
        const uploadResult = await cloudinaryInstance.uploader.upload(tempPath, {
            resource_type: "raw",
            folder: "letterheads"
        });
        
        // Clean up temp file
        await fs.unlink(tempPath);
        
        // Update PDF metadata in the database
        existingPDF.subject = subject || existingPDF.subject;
        existingPDF.cloudinary_url = uploadResult.secure_url;
        existingPDF.public_id = uploadResult.public_id;
        await existingPDF.save();
        
        // Return the updated PDF URL in the response
        res.status(200).json({ 
            message: 'PDF updated successfully', 
            url: uploadResult.secure_url 
        });
    } catch (err) {
        console.error("❌ PDF Edit Error:", err);
        res.status(500).json({ error: "Failed to update PDF" });
    }
};

export const sendMail = async(req, res)=>{
    const { email, subject, message, cloudinaryUrl, letterHeadId } = req.body;
    console.log("Sending email...");
    try{
        if (!email || !subject || !message || !cloudinaryUrl || !letterHeadId) {
            return res.status(400).json({
              error: "All fields (email, subject, message, cloudinaryUrl) are required.",
            });
          }
          
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format." });
        }

        const response = await axios.get(cloudinaryUrl, { responseType: "arraybuffer" });
        const pdfBuffer = Buffer.from(response.data, "binary");

    const mailOptions = {
      from: process.env.SMTP_MAIL,
      to: email,
      subject: subject,
      text: message,
      attachments: [
        {
          filename: "letterhead.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_MAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      });

    const info = await transporter.sendMail(mailOptions);

    const letterHead = await LetterHead.findById({_id:letterHeadId});
    if(!letterHead){
        return res.status(400).json({ message: "Letterhead not found" });
    }
    letterHead.isSent = true;
    await letterHead.save();

    console.log("Email sent successfully.");

    await SentMessage.create({
        email,
        subject,
        message,
        cloudinaryUrl,
      });

    res.status(200).json({ message: "Email sent successfully." });
    }catch(err){
        console.error("❌ Email Error:", err);
        res.status(500).json({ error: "Failed to send email" });
    }
};

export const getSentMessages = async (req, res) => {
    try {
      const { email } = req.body;
  
      let query = {};
      if (email) {
        query.email = email;
      }
  
      const sentMessages = await SentMessage.find(query);
      res.status(200).json(sentMessages);
    } catch (err) {
      console.error("❌ Get Sent Messages Error:", err);
      res.status(500).json({ error: "Failed to get sent messages" });
    }
  };
  
  export const getLetterHeads = async(req, res)=>{
    try {
        const {id} = req.body;
        let query = {};
        if(id){
            query._id = id;
        }
        const letterheads = await PDFFile.find(query);
        res.status(200).json(letterheads);
      } catch (err) {
        console.error("❌ Get Letterheads Error:", err);
        res.status(500).json({ error: "Failed to get letterheads" });
      }
  }