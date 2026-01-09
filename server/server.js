const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
require('dotenv').config();

const Note = require('./models/Note');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();

// CORS
app.use(cors({
  origin: ['https://notes-sharing-app-260f8.web.app', 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { dbName: "notesApp" })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Multer configuration - store files temporarily in memory
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB per file (Cloudinary free tier limit)
});

// Test route
app.get('/', (req, res) => res.json({ message: 'Notes API is running' }));

// Upload endpoint with Cloudinary
app.post('/upload', upload.array('file'), async (req, res) => {
  try {
    console.log('=== UPLOAD DEBUG ===');
    console.log('Files received:', req.files?.length);
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const createdNotes = [];

    for (const file of req.files) {
      console.log('Processing file:', file.originalname);
      
      // Upload to Cloudinary
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'auto', // Automatically detect file type
            folder: 'notes-app', // Organize files in a folder
            public_id: `${Date.now()}-${path.parse(file.originalname).name}`, // Unique filename
            use_filename: true,
            unique_filename: false
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        
        // Pipe the buffer to Cloudinary
        uploadStream.end(file.buffer);
      });

      console.log('Uploaded to Cloudinary:', uploadResult.secure_url);

      // Save note to database with Cloudinary URL
      const note = await Note.create({
        fileName: file.originalname,
        filePath: uploadResult.secure_url, // Store Cloudinary URL
        cloudinaryPublicId: uploadResult.public_id, // Store for deletion
        fileType: file.mimetype,
        fileSize: file.size,
        year: Number(req.body.year),
        semester: Number(req.body.semester),
        subject: req.body.subject,
        description: req.body.description,
        uploadedBy: req.body.uploadedBy,
        uploadedByEmail: req.body.uploadedByEmail
      });
      
      createdNotes.push(note);
    }

    console.log('=== UPLOAD COMPLETE ===');
    res.json({ success: true, notes: createdNotes });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: 'Upload failed', details: err.message });
  }
});

// Get all notes
app.get('/notes', async (req, res) => {
  try {
    const notes = await Note.find().sort({ uploadedAt: -1 });
    res.json(notes);
  } catch (err) {
    console.error('Fetch notes error:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Download a note file from Cloudinary
app.get('/notes/:id/download', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    console.log('Redirecting to Cloudinary URL:', note.filePath);
    
    // Cloudinary URLs support download via fl_attachment flag
    const downloadUrl = note.filePath.replace('/upload/', '/upload/fl_attachment/');
    
    // Redirect to Cloudinary's download URL
    res.redirect(downloadUrl);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to download file', details: err.message });
  }
});

// Like a note
app.post('/notes/:id/like', async (req, res) => {
  const noteId = req.params.id;
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'User email required' });

  try {
    const note = await Note.findById(noteId);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    if (!note.likedBy.includes(email)) {
      note.likes += 1;
      note.likedBy.push(email);
    } else {
      note.likes -= 1;
      note.likedBy = note.likedBy.filter(e => e !== email);
    }

    await note.save();
    res.json({ success: true, likes: note.likes, likedBy: note.likedBy });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to like note' });
  }
});

// Delete a note
app.delete('/notes/:id', async (req, res) => {
  const noteId = req.params.id;
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'User email required' });

  try {
    const note = await Note.findById(noteId);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    if (note.uploadedByEmail !== email) {
      return res.status(403).json({ error: 'You can only delete your own uploads' });
    }

    // Delete from Cloudinary if cloudinaryPublicId exists
    if (note.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(note.cloudinaryPublicId, { resource_type: 'raw' });
        console.log(`Deleted from Cloudinary: ${note.cloudinaryPublicId}`);
      } catch (cloudError) {
        console.warn('Cloudinary deletion warning:', cloudError.message);
      }
    }

    await Note.findByIdAndDelete(noteId);
    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));