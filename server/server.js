const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const Note = require('./models/Note');
const fs = require('fs');

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const app = express();

// Allow cross-origin requests from your frontend
app.use(cors({
  origin: ['https://notes-sharing-app-260f8.web.app'], // <-- your Firebase frontend URL
  credentials: true
}));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Atlas connection
mongoose.connect(process.env.MONGO_URI, { dbName: "notesApp" })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Multer storage (disk)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB

// Upload API
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const fileURL = `https://notes-sharing-app-mww6.onrender.com/uploads/${req.file.filename}`;

    const note = await Note.create({
      fileName: req.file.originalname,
      filePath: fileURL, // <-- full URL for frontend
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      year: Number(req.body.year),
      semester: Number(req.body.semester),
      subject: req.body.subject,
      description: req.body.description,
      uploadedBy: req.body.uploadedBy,
      uploadedByEmail: req.body.uploadedByEmail
    });

    res.json({ success: true, note });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Upload failed' });
  }
});

// Get feed
app.get('/notes', async (req, res) => {
  try {
    const notes = await Note.find().sort({ uploadedAt: -1 });
    res.json(notes);
  } catch (err) {
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
      // Optional: allow unlike
      note.likes -= 1;
      note.likedBy = note.likedBy.filter(e => e !== email);
      await note.save();
    }

    res.json({ success: true, likes: note.likes, likedBy: note.likedBy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to like note' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
