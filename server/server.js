const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const Note = require('./models/Note');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();

// CORS
app.use(cors({
  origin: ['https://notes-sharing-app-260f8.web.app', 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json());

// Serve static files
app.use('/uploads', express.static(UPLOAD_DIR));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { dbName: "notesApp" })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${Date.now()}-${nameWithoutExt}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB per file
});

// Test route
app.get('/', (req, res) => res.json({ message: 'Notes API is running' }));

// Upload endpoint
app.post('/upload', upload.array('file'), async (req, res) => {
  try {
    console.log('=== UPLOAD DEBUG ===');
    console.log('Files received:', req.files?.length);
    console.log('Upload directory:', UPLOAD_DIR);
    console.log('Body:', req.body);
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const createdNotes = [];

    for (const file of req.files) {
      console.log('Processing file:', file.filename);
      console.log('File saved to:', file.path);
      
      // Store relative path WITHOUT leading slash
      const filePath = `uploads/${file.filename}`;
      
      const note = await Note.create({
        fileName: file.originalname,
        filePath, // Should be: uploads/filename.ext (no leading slash)
        fileType: file.mimetype,
        fileSize: file.size,
        year: Number(req.body.year),
        semester: Number(req.body.semester),
        subject: req.body.subject,
        description: req.body.description,
        uploadedBy: req.body.uploadedBy,
        uploadedByEmail: req.body.uploadedByEmail
      });
      
      console.log('Note created with filePath:', note.filePath);
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

// Download a note file
app.get('/notes/:id/download', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    // Remove leading slash if present
    let cleanPath = note.filePath.startsWith('/') ? note.filePath.substring(1) : note.filePath;
    const filePath = path.join(__dirname, cleanPath);
    
    console.log('Downloading from:', filePath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.download(filePath, note.fileName, (err) => {
      if (err) {
        console.error('Download stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download file' });
        }
      }
    });
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

    if (note.uploadedByEmail !== email) return res.status(403).json({ error: 'You can only delete your own uploads' });

    const filePath = path.join(__dirname, note.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted file: ${filePath}`);
    } else {
      console.warn(`File not found: ${filePath}`);
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