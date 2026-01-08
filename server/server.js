const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const Note = require('./models/Note');
const fs = require('fs');

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const app = express();

// IMPORTANT: CORS must come BEFORE routes
app.use(cors({
  origin: ['https://notes-sharing-app-260f8.web.app', 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json());

// IMPORTANT: Serve static files with proper headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // Set proper content type based on file extension
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (filePath.endsWith('.docx')) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }
  }
}));

// MongoDB Atlas connection
mongoose.connect(process.env.MONGO_URI, { dbName: "notesApp" })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    // Keep original extension
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, Date.now() + '-' + nameWithoutExt + ext);
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// Test route to verify server is working
app.get('/', (req, res) => {
  res.json({ message: 'Notes API is running' });
});

// Upload API
app.post('/upload', upload.array('file'), async (req, res) => {
  try {
    const createdNotes = [];

    for (const file of req.files) {
      const fileURL = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
      const note = await Note.create({
        fileName: file.originalname,
        filePath: fileURL,
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

    res.json({ success: true, notes: createdNotes });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: 'Upload failed', details: err.message });
  }
});

// Get feed
app.get('/notes', async (req, res) => {
  try {
    const notes = await Note.find().sort({ uploadedAt: -1 });
    console.log(`Fetched ${notes.length} notes`);
    res.json(notes);
  } catch (err) {
    console.error('Fetch notes error:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Like API
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
      await note.save();
    } else {
      note.likes -= 1;
      note.likedBy = note.likedBy.filter(e => e !== email);
      await note.save();
    }

    res.json({ success: true, likes: note.likes, likedBy: note.likedBy });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to like note' });
  }
});

// Delete API
app.delete('/notes/:id', async (req, res) => {
  const noteId = req.params.id;
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'User email required' });

  try {
    const note = await Note.findById(noteId);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    // Check if user owns this note
    if (note.uploadedByEmail !== email) {
      return res.status(403).json({ error: 'You can only delete your own uploads' });
    }

    // Delete file from disk
    const filename = path.basename(new URL(note.filePath).pathname);
    const filePath = path.join(__dirname, 'uploads', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await Note.findByIdAndDelete(noteId);

    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Static files served from: ${path.join(__dirname, 'uploads')}`);
});