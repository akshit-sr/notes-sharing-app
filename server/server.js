const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const Note = require('./models/Note');

const fs = require('fs');

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const app = express();
app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Atlas (metadata only)
mongoose.connect(
  process.env.MONGO_URI,
  {dbName: "notesApp"}
)
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

// Multer storage (DISK)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// Upload API
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const note = await Note.create({
      fileName: req.file.originalname,
      filePath: `/uploads/${req.file.filename}`,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      year: req.body.year,
      semester: req.body.semester,
      subject: req.body.subject,
      description: req.body.description,
      uploadedBy: req.body.uploadedBy,
      uploadedByEmail: req.body.uploadedByEmail
    });

    res.json(note);
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get feed
app.get('/notes', async (req, res) => {
  const notes = await Note.find().sort({ createdAt: -1 });
  res.json(notes);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});