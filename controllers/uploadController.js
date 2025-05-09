import { cloudinaryInstance as cloudinary } from "../config/cloudinary.js";
import { Signature } from '../models/signatureModel.js';
import { LetterHead } from "../models/letterHeadModel.js";
import { Document } from "../models/Documents.js";

export const uploadImage = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      console.log(req.body);
      const { userId, userName } = req.body;

      if (!userId || !userName) {
        return res.status(400).json({ message: "User ID and name are required" });
      }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'signatures', // ✅ Optional folder name in Cloudinary
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      const signature = await Signature.create({
        url: result.secure_url,
        public_id: result.public_id,
        userId: userId,
        name: userName
      });

      return res.status(200).json({
        message: "Image uploaded successfully",
        data: signature
      });
  
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({
        message: "Something went wrong",
        error: error.message,
      });
    }
  };

  export const deleteImage = async (req, res) => {
    const { public_id } = req.params;
  
    try {
      const result = await cloudinary.uploader.destroy(public_id);
  
      const deletedSignature = await Signature.findOneAndDelete({ public_id });

      if (deletedSignature) {
        return res.status(200).json({
          message: "Image deleted successfully from both Cloudinary and the database",
        });
      } else {
        return res.status(404).json({
          message: "Image not found in the database",
        });
      }
    } catch (error) {
      console.error("Delete error:", error);
      return res.status(500).json({
        message: "Something went wrong",
        error: error.message,
      });
    }
  };
  

export const getImages = async (req, res) => {
  try {
    const imageUrls = await Signature.find().select("url public_id userId name");

    return res.status(200).json({ images: imageUrls });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch images",
      error: error.message,
    });
  }
};
  
export const editImage = async (req, res) => {
  const { public_id } = req.params;
  const {name} = req.body;
  try {

    // Step 1: Find the image in the database by its public_id
    const signature = await Signature.findOne({ public_id });
    
    if (!signature) {
      return res.status(404).json({ message: "Signature not found" });
    }

    const file = req.file;

    // If a new image is uploaded, replace it
    if (file) {
      // Delete the old image from Cloudinary
      const cloudinaryResult = await cloudinary.uploader.destroy(public_id);
      if (cloudinaryResult.result !== "ok") {
        return res.status(500).json({ message: "Failed to delete old image from Cloudinary" });
      }

      // Upload the new image to Cloudinary
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "signatures",
            resource_type: "image",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(file.buffer);
      });

      signature.url = result.secure_url;
      signature.public_id = result.public_id;
    }

    // Update name if provided
    if (name) {
      signature.name = name;
    }

    await signature.save(); 
  
    return res.status(200).json({
      message: "Signature updated successfully",
      data: {
        url: signature.url,
        public_id: signature.public_id,
        name: signature.name,
      },
    });

  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
};

export const uploadFile = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const files = req.files;
    const body = req.body;
    const {subject, body_text, image_id} = req.body;
   
    const file_link = [];
    const publicIds = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const customName = body[`files[${i}][name]`] || file.originalname?.split('.')[0];
      // console.log(body[`files[${i}][name]`]);
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'files',
            resource_type: 'auto'
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(file.buffer);
      });
    
      file_link.push({
        public_id: result.public_id,
        url: result.secure_url,
        file_name: customName
      });
      publicIds.push(result.public_id);
    }

    const letterHead = await LetterHead.create({
      file_link,
      public_id: publicIds,
      image_id: image_id,
      subject: subject,
      body_text: body_text
    });

    return res.status(200).json({
      message: "File uploaded successfully",
      data: letterHead
    });

  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
};

export const deleteFile = async (req, res) => {
  const { id } = req.params;

  try {
    const letterHead = await LetterHead.findById(id);

    if (!letterHead) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Step 1: Delete all files from Cloudinary
    for (const file of letterHead.file_link) {
      if (file.public_id) {
        await cloudinary.uploader.destroy(file.public_id);
      }
    }

    // Step 2: Delete the document from MongoDB
    await LetterHead.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Letterhead and associated files deleted successfully",
    });

  } catch (error) {
    console.error("Delete error:", error);
    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
};


export const getFiles = async (req, res) => {
try {
  const files = await LetterHead.find().select("file_link image_id public_id subject body_text");

  return res.status(200).json({ files });
} catch (error) {
  return res.status(500).json({
    message: "Failed to fetch images",
    error: error.message,
  });
}
};

export const editFile = async (req, res) => {
  const { id } = req.params;
  const { file_name, subject, body_text, image_id } = req.body;

  try {
    const letterHead = await LetterHead.findById(id);
    if (!letterHead) {
      return res.status(404).json({ message: "Document not found" });
    }

    const normalizedInputName = file_name.toLowerCase().trim();
    const fileIndex = letterHead.file_link.findIndex(f => 
      f.file_name.toLowerCase().trim() === normalizedInputName
    );

    if (fileIndex === -1) {
      return res.status(404).json({ message: "File not found in file_link" });
    }

    const oldFile = letterHead.file_link[fileIndex];
    const oldPublicId = oldFile.public_id;

    // Step 1: Delete from Cloudinary
    await cloudinary.uploader.destroy(oldPublicId);

    const file = req.files && req.files[0];
    console.log("Incoming body:", req.body);

    const uploadedFileName = req.body.files?.[0]?.name || file.originalname;

    console.log(uploadedFileName);
    if (!file || !file.buffer || file.buffer.length === 0) {
      return res.status(400).json({ message: "No file provided or file is empty" });
    }

        // console.log(file);

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: "files", resource_type: "auto" },
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      ).end(file.buffer);
    });

    // Step 3: Update file_link entry
    letterHead.file_link[fileIndex] = {
      public_id: uploadResult.public_id,
      url: uploadResult.secure_url,
      file_name: uploadedFileName || file.originalname,
    };
    

    // Optional: update other fields
    if (subject) letterHead.subject = subject;
    if (body_text) letterHead.body_text = body_text;
    if (image_id) letterHead.image_id = image_id;

    await letterHead.save();

    return res.status(200).json({
      success: true,
      message: "File updated successfully",
      data: letterHead
    });

  } catch (error) {
    console.error("editFile error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

export const uploadDocFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "documents",
          resource_type: "auto", // handles PDFs, docs, etc.
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const newDoc = await Document.create({
      file_name: req.file.originalname,
      file_link: result.secure_url,
      public_id: result.public_id,
    });

    return res.status(200).json({
      message: "Document uploaded successfully",
      data: newDoc,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const documents = await Document.find().sort({ uploadedAt: -1 }); // newest first
    return res.status(200).json({
      message: "Documents retrieved successfully",
      data: documents,
    });
  } catch (error) {
    console.error("Fetch error:", error);
    return res.status(500).json({
      message: "Failed to fetch documents",
      error: error.message,
    });
  }
};