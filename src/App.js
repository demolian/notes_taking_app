import React, { useState, useEffect, useRef } from 'react';
import './App.css'; // Import CSS
import { supabase } from './supabase/supabaseClient'; 
import imageCompression from 'browser-image-compression';
import axios from 'axios';
import PasswordModal from './PasswordModal'; // Correct import
import ImageModal from './ImageModal'; // Import the ImageModal
import CryptoJS from 'crypto-js'; // Import CryptoJS
import Login from './Login'; // Import the new Login component
import bcrypt from 'bcryptjs'; // Import bcrypt
import PasswordReset from './PasswordReset'; // Import the PasswordReset component
import NotesHistory from './components/NotesHistory'; // Import the NotesHistory component
import NoteDetail from './components/NoteDetail'; // Import the NoteDetail component
import { FaImage, FaCamera, FaSave, FaHistory, FaSignOutAlt, FaPlus, FaTimes, FaArrowLeft } from 'react-icons/fa';
import CustomQuill from './CustomQuill'; // Import our custom wrapper instead
import 'react-quill/dist/quill.snow.css'; // Import Quill styles

const secretKey = process.env.REACT_APP_SECRET_KEY; // Get the secret key from environment variables

// Function to encrypt data
function encryptData(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), secretKey).toString();
}

// Function to decrypt data
function decryptData(ciphertext) {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedData) {
      throw new Error('Decrypted data is empty');
    }

    return JSON.parse(decryptedData); // Ensure the decrypted data is parsed correctly
  } catch (error) {
    console.error('Decryption error:', error);
    return null; // Return null if decryption fails
  }
}

export default function App() {
  const [user, setUser] = useState(null); // New state to track the logged-in user
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [actionType, setActionType] = useState(''); // New state to track action type
  const [noteToEdit, setNoteToEdit] = useState(null);
  const [fullImageUrl, setFullImageUrl] = useState(null); // State for full-screen image
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false); // State to toggle between login and sign-up
  const [imageUrl, setImageUrl] = useState(null); // State for the image URL
  const [showPasswordReset, setShowPasswordReset] = useState(false); // New state for password reset view
  const [showHistory, setShowHistory] = useState(false); // New state to show history view
  const [selectedNote, setSelectedNote] = useState(null); // State for selected note in history
  const [isCameraActive, setIsCameraActive] = useState(false); // State for camera activation
  
  const videoRef = useRef(null); // Reference for the video element
  const cameraStream = useRef(null); // Reference to store camera stream

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error fetching session:', error);
      } else {
        setUser(session?.user || null);
        if (session?.user) {
          fetchNotes(); 
        }
      }
    };

    checkSession(); // Call the function to check the session

    // Set up real-time subscription
    const notesSubscription = supabase
      .channel('public:notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, payload => {
        fetchNotes(); // Refresh notes on any change
      })
      .subscribe();

    // Add paste event listener
    const handlePaste = (event) => {
      const items = event.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            setImage(blob);
            
            // Create a thumbnail preview URL
            const imageUrl = URL.createObjectURL(blob);
            setImageUrl(imageUrl);
          }
          break;
        }
      }
    };

    // Handle window resize or device orientation change
    const handleResize = () => {
      // If camera is active, we may need to adjust the video element
      if (isCameraActive && videoRef.current && videoRef.current.srcObject) {
        console.log('Window resized or device orientation changed while camera active');
        // Here we just log it, but in some cases you might need to
        // restart the camera with new dimensions for better results
      }
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('resize', handleResize);

    // Clean up subscription on unmount
    return () => {
      supabase.removeChannel(notesSubscription);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('resize', handleResize);
      
      // Clean up camera stream if active
      if (cameraStream.current) {
        cameraStream.current.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [isCameraActive]);

  // Fetch notes from Supabase
  const fetchNotes = async () => {
    if (!user) return; // Only fetch notes if a user is logged in
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id) // Filter notes by user ID
      .order('created_at', { ascending: false }); // Order by creation date

    if (error) {
      console.error('Error fetching notes:', error);
      return;
    }

    setNotes(data); // Set the fetched notes in state
  };

  // Function to call Google Gemini API
  async function callGeminiAI(inputText) {
    try {
      const response = await axios.post(
        'http://localhost:5000/generate',
        { text: inputText },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('Gemini AI Response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error calling Gemini AI:', error);
      alert('Error calling Gemini AI: ' + error.message);
    }
  }

  // Example usage of callGeminiAI
  async function analyzeNoteContent() {
    if (content) {
      const analysis = await callGeminiAI(content);
    }
  }

  // Function to upload an image to Supabase Storage and return its public URL
  async function uploadImage(file) {
    try {
      // Ensure the file is a valid Blob or File
      if (!(file instanceof Blob || file instanceof File)) {
        throw new Error('The file given is not an instance of Blob or File');
      }

      // Compress the image before uploading
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      };
      
      const compressedFile = await imageCompression(file, options);
      const fileName = `${Date.now()}_${file.name || 'image.jpg'}`; // Create a unique file name

      const { data, error } = await supabase.storage
        .from('notes-images')
        .upload(fileName, compressedFile, { cacheControl: '3600', upsert: false });

      if (error) {
        console.error('Supabase upload error:', error);
        throw error;
      }

      // Get public URL
      const publicUrl = supabase.storage
        .from('notes-images')
        .getPublicUrl(fileName).data.publicUrl;

      return publicUrl; // Return the public URL
    } catch (err) {
      console.error('Image upload error:', err);
      alert('Upload Error: ' + (err.message || 'Image upload failed'));
      return null;
    }
  }

  // Pick an image using the device's image library
  async function pickImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (file) {
        setImage(file);
        
        // Create a thumbnail preview URL
        const imagePreviewUrl = URL.createObjectURL(file);
        setImageUrl(imagePreviewUrl);
      }
    };

    input.click();
  }

  // Activate camera to take a picture
  const activateCamera = async () => {
    try {
      // First make sure any existing stream is stopped
      if (cameraStream.current) {
        stopCamera();
      }
      
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser');
      }
      
      // Try with ideal settings first
      const constraints = { 
        video: { 
          facingMode: { ideal: 'environment' }, // Use back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      
      console.log('Requesting camera access with constraints:', constraints);
      
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (initialError) {
        console.warn('Failed with ideal settings, trying fallback constraints:', initialError);
        
        // Fallback to basic constraints if the initial request fails
        const fallbackConstraints = { 
          video: true,  // Just request any video source
          audio: false
        };
        
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        console.log('Camera accessed with fallback constraints');
      }
      
      if (!stream) {
        throw new Error('Failed to get camera stream');
      }
      
      cameraStream.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Ensure video is muted
        
        // Ensure video playback starts
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, attempting to play');
          try {
            // Using play() with a timeout to ensure it's ready
            setTimeout(() => {
              const playPromise = videoRef.current.play();
              if (playPromise !== undefined) {
                playPromise.catch(err => {
                  console.error("Error playing video:", err);
                  alert("Could not start video playback. Please try again.");
                });
              }
            }, 100);
          } catch (err) {
            console.error("Error in play handler:", err);
          }
        };
        
        // Add a timeout as a fallback if metadata event doesn't fire
        setTimeout(() => {
          if (videoRef.current && videoRef.current.srcObject && !videoRef.current.playing) {
            console.log('Metadata event did not fire, trying to play video directly');
            videoRef.current.play().catch(err => {
              console.error("Error in fallback play:", err);
            });
          }
        }, 1000);
      } else {
        throw new Error('Video element reference is not available');
      }
      
      setIsCameraActive(true);
      console.log("Camera activated successfully");
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('Error accessing camera: ' + err.message);
      setIsCameraActive(false);
    }
  };
  
  // Take a picture from the camera
  const takePicture = () => {
    if (!videoRef.current) {
      console.error("Video element not available");
      alert("Cannot access camera view. Please try again.");
      return;
    }
    
    if (!videoRef.current.srcObject) {
      console.error("Video stream not available");
      alert("Camera stream not active. Please restart the camera.");
      return;
    }
    
    try {
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      
      // Get video dimensions - fallback to element dimensions if needed
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      if (!width || !height) {
        console.warn("Video dimensions not available, using element dimensions");
        width = video.offsetWidth || 640;
        height = video.offsetHeight || 480;
        
        if (!width || !height) {
          console.error("Could not determine video dimensions");
          alert("Could not capture image. Please try again.");
          return;
        }
      }
      
      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error("Could not get canvas context");
        alert("Failed to process image. Please try again.");
        return;
      }
      
      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0, width, height);
      
      // Convert canvas to blob with error handling
      try {
        canvas.toBlob((blob) => {
          if (blob) {
            // Create a new file with timestamp and proper extension
            const imageFile = new File([blob], `camera_image_${Date.now()}.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            
            setImage(imageFile);
            
            // Create a thumbnail preview URL
            const imageUrl = URL.createObjectURL(blob);
            setImageUrl(imageUrl);
            
            // Stop camera stream
            stopCamera();
            
            console.log("Picture taken successfully");
          } else {
            console.error("Failed to create image blob");
            alert("Failed to process image. Please try again.");
          }
        }, 'image/jpeg', 0.9);
      } catch (blobErr) {
        console.error("Error creating blob:", blobErr);
        alert("Failed to process the captured image.");
      }
    } catch (err) {
      console.error("Error taking picture:", err);
      alert("Error taking picture: " + err.message);
    }
  };
  
  // Stop camera
  const stopCamera = () => {
    console.log("Stopping camera");
    try {
      if (cameraStream.current) {
        const tracks = cameraStream.current.getTracks();
        console.log(`Stopping ${tracks.length} camera tracks`);
        
        tracks.forEach(track => {
          try {
            track.stop();
            console.log(`Track ${track.id} stopped successfully`);
          } catch (trackErr) {
            console.error(`Error stopping track ${track.id}:`, trackErr);
          }
        });
        
        cameraStream.current = null;
      } else {
        console.log("No camera stream to stop");
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        console.log("Video source cleared");
      }
      
      setIsCameraActive(false);
    } catch (err) {
      console.error("Error stopping camera:", err);
      // Still set the state to inactive even if there was an error
      setIsCameraActive(false);
    }
  };

  // Function to refresh notes
  function refreshNotes() {
    fetchNotes();
  }

  // Define Quill modules and formats for the editor
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'color': [] }, { 'background': [] }],
      ['blockquote', 'code-block'],
      ['link', 'image'],
      ['clean']
    ],
  };

  const quillFormats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'indent',
    'script',
    'color', 'background',
    'blockquote', 'code-block',
    'link', 'image'
  ];

  // Create or update a note
  async function saveNote() {
    if (!title.trim()) {
      alert('Please enter a title for your note');
      return;
    }
    
    let imageUrlToSave = null;
    let oldImageUrl = null;

    // If we are editing a note, get the current image URL to potentially delete it later
    if (editingId) {
      const { data: existingNote, error: fetchError } = await supabase
        .from('notes')
        .select('image_url')
        .eq('id', editingId)
        .single();
      
      if (!fetchError && existingNote) {
        oldImageUrl = existingNote.image_url;
      }
    }

    // Upload new image if it exists
    if (image instanceof Blob || image instanceof File) {
      imageUrlToSave = await uploadImage(image);
    } else if (imageUrl) {
      // If imageUrl exists and it's not from Supabase (doesn't contain storage.supabaseusercontent), 
      // it's a local preview URL and we need to upload it
      if (imageUrl.startsWith('blob:') || !imageUrl.includes('storage.supabaseusercontent')) {
        // This is a blob URL from a new image that hasn't been uploaded yet
        if (image) {
          imageUrlToSave = await uploadImage(image);
        }
      } else {
        // This is an existing image from Supabase, keep using it
        imageUrlToSave = imageUrl;
      }
    }

    const timestamp = new Date();
    const formattedDate = timestamp.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const encryptedTitle = encryptData(title); // Encrypt title
    const encryptedContent = encryptData(content); // Encrypt content

    if (editingId) {
      const { error } = await supabase
        .from('notes')
        .update({
          title: encryptedTitle,
          content: encryptedContent,
          image_url: imageUrlToSave,
          updated_at: timestamp.toISOString(),
          user_id: user.id,
        })
        .eq('id', editingId);

      if (error) {
        alert('Error updating note: ' + error.message);
        return;
      }

      // Delete old image if it was replaced or removed
      if (oldImageUrl && oldImageUrl !== imageUrlToSave && oldImageUrl.includes('storage.supabaseusercontent')) {
        try {
          // Extract the file path from the URL
          const oldImagePath = oldImageUrl.split('/').pop();
          
          if (oldImagePath) {
            console.log('Attempting to delete old image:', oldImagePath);
            const { error: storageError } = await supabase.storage
              .from('notes-images')
              .remove([oldImagePath]);

            if (storageError) {
              console.error('Error deleting old image from storage:', storageError);
            } else {
              console.log('Old image deleted successfully from storage');
            }
          }
        } catch (err) {
          console.error('Error processing image deletion:', err);
        }
      }
    } else {
      const { error } = await supabase
        .from('notes')
        .insert([{
          title: encryptedTitle,
          content: encryptedContent,
          image_url: imageUrlToSave,
          created_at: formattedDate,
          updated_at: formattedDate,
          user_id: user.id,
        }]);
      if (error) {
        alert('Error creating note: ' + error.message);
        return;
      }
    }

    // Reset form fields
    setTitle('');
    setContent('');
    setImage(null);
    setEditingId(null);
    setImageUrl(null);

    await fetchNotes(); // Refresh notes
  }

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this note?");
    if (confirmDelete) {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Error deleting note: ' + error.message);
      } else {
        fetchNotes(); // Refresh notes after deletion
      }
    }
  };

  const handleEdit = (note) => {
    const confirmEdit = window.confirm("Are you sure you want to edit this note?");
    if (confirmEdit) {
      setTitle(decryptData(note.title)); // Set the title for editing
      setContent(decryptData(note.content)); // Set the content for editing
      setEditingId(note.id); // Set the ID of the note being edited
      setImageUrl(note.image_url); // Set the image URL if it exists
      setShowHistory(false); // Hide history view when editing
    }
  };

  const confirmAction = async (password) => {
    const correctPassword = process.env.REACT_APP_ADMIN_PASSWORD;

    if (password.trim() !== correctPassword) {
      alert('Incorrect password.');
      setShowModal(false);
      return;
    }

    if (actionType === 'delete') {
      await deleteNote(noteToDelete);
    } else if (actionType === 'edit') {
      startEdit(noteToEdit);
    }

    setShowModal(false);
  };

  // Delete a note
  async function deleteNote(id) {
    try {
      // Get the note to retrieve the image URL
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select('image_url')
        .eq('id', id)
        .single();

      if (noteError) {
        alert('Error getting note: ' + noteError.message);
        return;
      }

      const imageUrl = noteData?.image_url;

      // Delete the note
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Error deleting note: ' + error.message);
        return;
      }

      // Delete the image from storage if it exists
      if (imageUrl && imageUrl.includes('storage.supabaseusercontent')) {
        try {
          // Extract the file path from the URL
          const urlParts = imageUrl.split('/');
          const imagePath = urlParts[urlParts.length - 1];
          
          if (imagePath) {
            console.log('Attempting to delete image:', imagePath);
            const { error: storageError } = await supabase.storage
              .from('notes-images')
              .remove([imagePath]);

            if (storageError) {
              console.error('Error deleting image from storage:', storageError);
            } else {
              console.log('Image deleted successfully from storage');
            }
          }
        } catch (err) {
          console.error('Error processing image deletion:', err);
        }
      }

      // Refresh notes without reloading
      refreshNotes();
    } catch (err) {
      console.error('Error in deleteNote function:', err);
      alert('An error occurred while deleting the note. Please try again.');
    }
  }

  // Start editing a note
  function startEdit(note) {
    const decryptedTitle = decryptData(note.title); // Decrypt title
    const decryptedContent = decryptData(note.content); // Decrypt content

    setTitle(decryptedTitle); // Set decrypted title
    setContent(decryptedContent); // Set decrypted content
    setImageUrl(note.image_url); // Set image URL
    setEditingId(note.id); // Set editing ID
  }

  // Render a note item
  const renderItem = (item) => {
    try {
      const title = decryptData(item.title);
      const content = decryptData(item.content);
      const imageUrl = item.image_url;

      if (!title || !content) {
        return null; // Skip rendering if decryption fails
      }

      return (
        <div className="noteCard" key={item.id}>
          <h4>{title}</h4>
          <div className="note-content" dangerouslySetInnerHTML={{ __html: content }}></div>
          {imageUrl && (
            <img 
              src={imageUrl} 
              alt="Note related" 
              style={{ maxWidth: '100%', height: 'auto' }} 
              onClick={() => setFullImageUrl(imageUrl)} // Add click handler to view full image
            />
          )}
          <p>Created At: {item.created_at}</p>
          <div className="note-actions">
            <button onClick={() => handleEdit(item)} className="edit-btn">Edit</button>
            <button onClick={() => handleDelete(item.id)} className="delete-btn">Delete</button>
          </div>
        </div>
      );
    } catch (error) {
      console.error("Error rendering note:", error);
      return null; // Return null if there's an error
    }
  };

  // Function to handle user login
  const handleLogin = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) {
      setError('Login error: User not found. Please sign up.');
      return;
    }

    const isMatch = await bcrypt.compare(password, data.password);
    if (isMatch) {
      setUser(data); // Set the logged-in user
      await fetchNotes(); // Fetch notes for the logged-in user
    } else {
      setError('Login error: Incorrect password.');
    }
  };

  // Function to handle user sign-up
  const handleSignUp = async () => {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert([{ username, password: hashedPassword }]);

    if (error) {
      setError('Sign-up error: ' + error.message);
      return; // Exit if there's an error
    }

    if (data && data.length > 0) {
      setUser(data[0]); // Set the logged-in user
      await fetchNotes(); // Fetch notes for the new user
      alert('Sign-up successful!'); // Show success message
    } else {
      setError('Sign-up error: No user data returned.');
    }
  };

  // Function to handle user logout
  const handleLogout = async () => {
    // Make sure camera is stopped if active
    if (isCameraActive) {
      stopCamera();
    }
    
    await supabase.auth.signOut();
    setUser(null); // Clear user state
    setNotes([]); // Clear notes
  };

  // Function to fetch all previous notes when History button is clicked
  const handleHistory = async () => {
    // Make sure camera is stopped if active
    if (isCameraActive) {
      stopCamera();
    }
    
    await fetchNotes(); // Fetch all notes for the logged-in user
    setShowHistory(true); // Show history view
    setSelectedNote(null); // Reset selected note
  };
  
  // Function to view a note from history
  const handleViewNote = (note) => {
    setSelectedNote(note); // Set the selected note
  };
  
  // Function to go back from note detail to history
  const handleBackToHistory = () => {
    setSelectedNote(null); // Reset selected note
  };
  
  // Function to go back from history to main dashboard
  const handleBackToDashboard = () => {
    setShowHistory(false); // Hide history view
  };
  
  // Clear image from form
  const handleClearImage = () => {
    setImage(null);
    setImageUrl(null);
  };

  return (
    <div className="container">
      {user ? (
        <div className="dashboard">
          <div className="sidebar">
            <h2>Welcome {user.username}</h2>
            <button className="sidebar-btn history-button" onClick={handleHistory}>
              <FaHistory /> History
            </button>
            <button className="sidebar-btn logout-button" onClick={handleLogout}>
              <FaSignOutAlt /> Logout
            </button>
          </div>
          <div className="main-content">
            {showHistory ? (
              selectedNote ? (
                <NoteDetail 
                  note={selectedNote} 
                  onBack={handleBackToHistory}
                  decryptData={decryptData}
                />
              ) : (
                <>
                  <button className="back-to-dashboard" onClick={handleBackToDashboard}>
                    <FaArrowLeft /> Back to Dashboard
                  </button>
                  <NotesHistory 
                    notes={notes} 
                    onViewNote={handleViewNote}
                    decryptData={decryptData}
                  />
                </>
              )
            ) : (
              <>
                <h3>Add a New Note</h3>
                <div className="note-form">
                  <input
                    type="text"
                    placeholder="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="note-input"
                  />
                  <CustomQuill
                    placeholder="Content (You can paste images directly here)"
                    value={content}
                    onChange={setContent}
                    modules={quillModules}
                    formats={quillFormats}
                    className="note-editor"
                  />
                  
                  {isCameraActive ? (
                    <div className="camera-container">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted
                        className="camera-preview"
                        style={{ width: '100%', maxHeight: '400px', background: '#000' }}
                      />
                      <div className="camera-controls">
                        <button onClick={takePicture} className="take-photo-btn">Take Photo</button>
                        <button onClick={stopCamera} className="cancel-btn">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="image-preview-container">
                        {imageUrl && (
                          <div className="image-preview-wrapper">
                            <img 
                              src={imageUrl} 
                              alt="Preview" 
                              className="image-preview" 
                            />
                            <button 
                              onClick={handleClearImage} 
                              className="clear-image-btn"
                            >
                              <FaTimes />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="button-row">
                        <button onClick={pickImage} className="action-btn">
                          <FaImage /> Pick Image
                        </button>
                        <button onClick={activateCamera} className="action-btn">
                          <FaCamera /> Take Photo
                        </button>
                        <button onClick={saveNote} className="save-btn">
                          <FaSave /> {editingId ? 'Update Note' : 'Add Note'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="notes-container">
                  <h3>Your Notes</h3>
                  <div className="notesGrid">
                    {notes.map(renderItem)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        showPasswordReset ? (
          <PasswordReset onBack={() => setShowPasswordReset(false)} />
        ) : (
          <div className="login-form">
            <h2>{isSignUp ? 'Sign Up' : 'Login'}</h2>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={isSignUp ? handleSignUp : handleLogin}>
              {isSignUp ? 'Sign Up' : 'Login'}
            </button>
            {error && <p className="error">{error}</p>}
            <p>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <button onClick={() => setIsSignUp(!isSignUp)}>
                {isSignUp ? 'Login' : 'Sign Up'}
              </button>
            </p>
            {!isSignUp && (
              <p className="forgot-password">
                <button 
                  className="forgot-password-link"
                  onClick={() => setShowPasswordReset(true)}
                >
                  Forgot Password?
                </button>
              </p>
            )}
          </div>
        )
      )}
      {showModal && (
        <PasswordModal
          onConfirm={confirmAction}
          onCancel={() => setShowModal(false)}
        />
      )}
      {fullImageUrl && (
        <ImageModal
          imageUrl={fullImageUrl}
          onClose={() => setFullImageUrl(null)}
        />
      )}
    </div>
  );
}
