import React, { useState, useEffect } from 'react';
import { Upload, LogOut, Home, PlusCircle, User, Filter, X, Eye, Download, FileText, Moon, Sun } from 'lucide-react';
import { auth, provider } from './firebaseConfig';
import { signInWithPopup } from "firebase/auth";
import { signOut } from "firebase/auth";

const BASE_URL = 'https://notes-sharing-app-mww6.onrender.com';

const NotesApp = () => {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('feed');
  const [notes, setNotes] = useState([]);
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [filterSemester, setFilterSemester] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  // Upload form state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [viewingNote, setViewingNote] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  // Get available semesters based on selected year
  const getAvailableSemesters = () => {
    if (!year) return [];
    const yearNum = parseInt(year);
    return [yearNum * 2 - 1, yearNum * 2];
  };

  // Auto-hide error message after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Load saved data on mount
  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem('notesAppUser') || 'null');
    const savedDarkMode = JSON.parse(localStorage.getItem('darkMode') || 'false');
    setUser(savedUser);
    setDarkMode(savedDarkMode);

    fetchNotes(); // fetch all notes from BASE_URL
  }, []);

  const fetchNotes = () => {
    fetch(`${BASE_URL}/notes`)
      .then(res => res.json())
      .then(data => {
        setNotes(data);
        setFilteredNotes(data);
      })
      .catch(err => console.error(err));
  };

  // Reset semester when year changes
  useEffect(() => {
    const available = getAvailableSemesters();
    setSemester(available[0] || '');
  }, [year]);

  // Apply filters
  useEffect(() => {
    let filtered = notes;
    if (filterSemester) {
      filtered = filtered.filter(n => n.semester === filterSemester);
    }
    if (filterYear) {
      filtered = filtered.filter(n => n.year === filterYear);
    }
    if (filterSubject) {
      filtered = filtered.filter(n => n.subject.toLowerCase().includes(filterSubject.toLowerCase()));
    }
    setFilteredNotes(filtered);
  }, [filterSemester, filterYear, filterSubject, notes]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        const user = {
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          avatar: firebaseUser.photoURL
        };
        setUser(user);
        localStorage.setItem('notesAppUser', JSON.stringify(user));
      }
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userData = {
        email: user.email,
        name: user.displayName,
        avatar: user.photoURL
      };

      setUser(userData);
      localStorage.setItem('notesAppUser', JSON.stringify(userData));
    } catch (error) {
      console.error("Google sign-in error:", error);
      setErrorMessage("Failed to sign in with Google. Please try again.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    localStorage.removeItem('notesAppUser');
    setCurrentPage('feed');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name, 'Type:', file.type, 'Size:', file.size);

    // Validate file type - be more lenient with validation
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.pdf', '.docx'];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      setErrorMessage('Only JPG, JPEG, PDF or DOCX files are currently accepted!');
      e.target.value = '';
      return;
    }

    const isImage = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg');
     // Images max 500MB
    if (isImage && file.size > 500 * 1024 * 1024) {
      setErrorMessage('Images must be less than 500 MB');
      e.target.value = '';
      return;
    }

    // Other files max 500MB
    if (!isImage && file.size > 500 * 1024 * 1024) {
      setErrorMessage('Files must be less than 500 MB');
      e.target.value = '';
      return;
    }

    setUploadFile(file);
    setErrorMessage(''); // Clear any previous errors

    // Create preview for images (jpg, jpeg)
    
    if (isImage) {
      const reader = new FileReader();
      reader.onloadend = () => setUploadPreview(reader.result); // <-- CHANGED/FIXED: Preview for images
      reader.onerror = () => setUploadPreview(null);
      reader.readAsDataURL(file);
    } else {
      setUploadPreview(null);
    }
  };

  const handleUpload = async () => {
  if (!uploadFile || !semester || !year || !subject) {
    alert('Fill all required fields');
    return;
  }

  setUploading(true);

  const formData = new FormData();
  formData.append('file', uploadFile);
  formData.append('year', year);
  formData.append('semester', semester);
  formData.append('subject', subject);
  formData.append('description', description);
  formData.append('uploadedBy', user.name);
  formData.append('uploadedByEmail', user.email);

  try {
    const res = await fetch(`${BASE_URL}/upload`, { method: 'POST', body: formData });

    const data = await res.json();

    if (data.success) {
      setNotes(prev => [data.note, ...prev]);
      setFilteredNotes(prev => [data.note, ...prev]);
      setCurrentPage('feed');
    }
  } catch (err) {
    alert('Upload failed');
  }

    setUploading(false);
  };

  const handleLike = async (noteId) => {
    if (!user) return;

    try {
      const res = await fetch(`${BASE_URL}/notes/${noteId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });

      if (res.ok) {
        fetchNotes(); // Refresh notes to show updated likes
      } else {
        console.error('Like failed');
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const clearFilters = () => {
    setFilterSemester('');
    setFilterYear('');
    setFilterSubject('');
  };

  const handleDownloadPDF = (note) => {
    const fileUrl = `${BASE_URL}${note.filePath}`;
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = note.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', JSON.stringify(newMode));
  };

  // Login Page
  if (!user) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-linear-to-br from-indigo-100 via-purple-50 to-pink-100'} flex items-center justify-center p-4`}>
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl p-8 max-w-md w-full`}>
          <div className="text-center mb-8">
            <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-2`}>Notes Sharing</h1>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Share and discover study materials</p>
          </div>
          
          <button
            onClick={handleGoogleLogin}
            className={`w-full ${darkMode ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'} border-2 rounded-lg py-3 px-4 flex items-center justify-center gap-3 transition-colors font-medium`}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <button
            onClick={toggleDarkMode}
            className={`w-full mt-4 ${darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} rounded-lg py-2 px-4 flex items-center justify-center gap-2 transition-colors`}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Error Notification */}
      {errorMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-red-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 max-w-md">
            <div className="bg-white rounded-full p-1">
              <X className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-semibold">Upload Error</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage('')}
              className="ml-4 hover:bg-red-700 rounded p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingNote && viewingNote.fileType !== 'application/pdf' && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="p-3 sm:p-4 border-b flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="font-semibold text-gray-800 truncate text-sm sm:text-base">{viewingNote.fileName}</h3>
                <p className="text-xs sm:text-sm text-gray-600 truncate">{viewingNote.subject} - Semester {viewingNote.semester}</p>
              </div>
              <button
                onClick={() => setViewingNote(null)}
                className="text-gray-600 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 shrink-0"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-2 sm:p-4">
              <img
                src={viewingNote.fileData}
                alt={viewingNote.fileName}
                className="max-w-full h-auto mx-auto rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`${darkMode ? 'bg-gray-800 border-b border-gray-700' : 'bg-white'} shadow-sm sticky top-0 z-10`}>
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center">
              <Upload className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </div>
            <h1 className={`text-base sm:text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Notes Sharing</h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setCurrentPage('feed')}
              className={`p-2 rounded-lg transition-colors ${currentPage === 'feed' ? 'bg-indigo-100 text-indigo-600' : darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={() => setCurrentPage('upload')}
              className={`p-2 rounded-lg transition-colors ${currentPage === 'upload' ? 'bg-indigo-100 text-indigo-600' : darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
            <div className={`flex items-center gap-2 sm:gap-3 ${darkMode ? 'border-gray-700' : 'border-gray-200'} border-l pl-2 sm:pl-4`}>
              <img src={user.avatar} alt={user.name} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full" />
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Upload Page */}
      {currentPage === 'upload' && (
        <div className="max-w-3xl mx-auto p-4 sm:p-6">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-8`}>
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-6`}>Upload Notes</h2>
            
            <div className="space-y-6">
              {/* File Upload */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                  Upload File (JPG, JPEG, PDF, DOCX - Max 500MB)
                </label>
                <div className={`border-2 border-dashed ${darkMode ? 'border-gray-600 hover:border-indigo-500' : 'border-gray-300 hover:border-indigo-400'} rounded-lg p-8 text-center transition-colors`}>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.pdf,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {uploadPreview ? (
                      <img src={uploadPreview} alt="Preview" className="max-h-48 mx-auto mb-4 rounded" />
                    ) : (
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    )}
                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {uploadFile ? uploadFile.name : 'Click to upload or drag and drop'}
                    </p>
                  </label>
                </div>
              </div>

              {/* Year */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                  Year *
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className={`w-full px-4 py-2 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                  required
                >
                  <option value="">Select Year</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>

              {/* Semester */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                  Semester *
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className={`w-full px-4 py-2 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white disabled:bg-gray-800' : 'bg-white border-gray-300 text-gray-900 disabled:bg-gray-100'} rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed`}
                  required
                  disabled={!year}
                >
                  <option value="">{year ? 'Select Semester' : 'Select Year First'}</option>
                  {getAvailableSemesters().map(sem => (
                    <option key={sem} value={sem}>Semester {sem}</option>
                  ))}
                </select>
                {!year && (
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>Please select a year first</p>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                  Subject *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Data Structures, Calculus, Physics"
                  className={`w-full px-4 py-2 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'} rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add any additional information..."
                  rows="3"
                  className={`w-full px-4 py-2 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'} rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                />
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
              >
                {uploading ? 'Uploading...' : 'Upload Notes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feed Page */}
      {currentPage === 'feed' && (
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          {/* Filters */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-800'} flex items-center gap-2 text-sm sm:text-base`}>
                <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
                Filters
              </h3>
              {(filterSemester || filterYear || filterSubject) && (
                <button
                  onClick={clearFilters}
                  className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4" />
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className={`px-3 py-2 text-sm sm:text-base border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded-lg focus:ring-2 focus:ring-indigo-500`}
              >
                <option value="">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                  <option key={sem} value={sem}>Semester {sem}</option>
                ))}
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className={`px-3 py-2 text-sm sm:text-base border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded-lg focus:ring-2 focus:ring-indigo-500`}
              >
                <option value="">All Years</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
              <input
                type="text"
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                placeholder="Search by subject..."
                className={`px-3 py-2 text-sm sm:text-base border ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'} rounded-lg focus:ring-2 focus:ring-indigo-500`}
              />
            </div>
          </div>

          {/* Notes Feed */}
          {filteredNotes.length === 0 ? (
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-12 text-center`}>
              <Upload className={`w-16 h-16 ${darkMode ? 'text-gray-600' : 'text-gray-300'} mx-auto mb-4`} />
              <h3 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-800'} mb-2`}>No notes yet</h3>
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>Be the first to share your notes!</p>
              <button
                onClick={() => setCurrentPage('upload')}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Upload Notes
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredNotes.map(note => (
                <div key={note.id} className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm overflow-hidden`}>
                  {/* Header */}
                  <div className="p-4 flex items-center gap-3">
                    <img
                      src={`https://ui-avatars.com/api/?name=${note.uploadedBy}&background=4F46E5&color=fff`}
                      alt={note.uploadedBy}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{note.uploadedBy}</p>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {new Date(note.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Image Preview */}
                  {note.fileType && note.fileType.startsWith('image/') && (
                    <div 
                      className="cursor-pointer relative group"
                      onClick={() => setViewingNote(note)}
                    >
                      <img src={`http://localhost:5000${note.filePath}`} alt={note.fileName} className="w-full" />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                        <Eye className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  )}

                  {/* PDF Indicator */}
                  {note.fileType === 'application/pdf' && (
                    <div 
                      className="bg-linear-to-br from-red-50 to-orange-50 p-12 flex items-center justify-center cursor-pointer hover:from-red-100 hover:to-orange-100 transition-colors border-y"
                      onClick={() => handleDownloadPDF(note)}
                    >
                      <div className="text-center">
                        <div className="bg-red-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Download className="w-8 h-8 text-white" />
                        </div>
                        <p className="text-gray-800 font-semibold text-lg mb-1">PDF Document</p>
                        <p className="text-gray-600">Click to download</p>
                      </div>
                    </div>
                  )}

                  {/* DOCX Indicator */}
                  {note.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && (
                    <div 
                      className="bg-linear-to-br from-blue-50 to-indigo-50 p-12 flex items-center justify-center cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors border-y"
                      onClick={() => handleDownloadPDF(note)}
                    >
                      <div className="text-center">
                        <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FileText className="w-8 h-8 text-white" />
                        </div>
                        <p className="text-gray-800 font-semibold text-lg mb-1">Word Document</p>
                        <p className="text-gray-600">Click to download</p>
                      </div>
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
                        Semester {note.semester}
                      </span>
                      <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                        Year {note.year}
                      </span>
                      <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-sm font-medium">
                        {note.subject}
                      </span>
                    </div>

                    <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-800'} mb-2`}>{note.fileName}</h3>
                    {note.description && (
                      <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-3`}>{note.description}</p>
                    )}
                    <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>File size: {note.fileSize}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                      {note.fileType === 'application/pdf' ? (
                        <button
                          onClick={() => handleDownloadPDF(note)}
                          className="flex items-center gap-2 text-red-600 hover:text-red-700 transition-colors font-medium"
                        >
                          <Download className="w-5 h-5" />
                          Download PDF
                        </button>
                      ) : note.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? (
                        <button
                          onClick={() => handleDownloadPDF(note)}
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors font-medium"
                        >
                          <Download className="w-5 h-5" />
                          Download DOCX
                        </button>
                      ) : (
                        <button
                          onClick={() => setViewingNote(note)}
                          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 transition-colors font-medium"
                        >
                          <Eye className="w-5 h-5" />
                          View
                        </button>
                      )}
                      <button
                        onClick={() => handleLike(note.id)}
                        className={`flex items-center gap-2 transition-colors ${
                          note.likedBy.includes(user.email)
                            ? 'text-red-600'
                            : 'text-gray-600 hover:text-red-600'
                        }`}
                      >
                        <svg
                          className="w-6 h-6"
                          fill={note.likedBy.includes(user.email) ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
                        </svg>
                        <span className="font-medium">{note.likes}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotesApp;