const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  year: { type: String, required: true },
  semester: { type: String, required: true },
  subject: { type: String, required: true },
  description: { type: String, default: '' },
  uploadedBy: { type: String, default: 'Anonymous' },
  uploadedByEmail: { type: String, default: '' },
  uploadedAt: { type: Date, default: Date.now },
  likes: { type: Number, default: 0 },
  likedBy: { type: [String], default: [] },
  cloudinaryPublicId: { type: String }
});

module.exports = mongoose.model('Note', noteSchema);