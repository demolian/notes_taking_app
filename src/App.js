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
import { FaImage, FaCamera, FaSave, FaHistory, FaSignOutAlt, FaPlus, FaTimes, FaArrowLeft, FaCloudUploadAlt, FaEdit, FaTrash, FaSearch, FaDownload, FaUpload, FaCloudDownloadAlt, FaFileArchive } from 'react-icons/fa';
import CustomQuill from './CustomQuill'; // Import our custom wrapper instead
import 'react-quill/dist/quill.snow.css'; // Import Quill styles
import { v4 as uuidv4 } from 'uuid';
import Crypto from 'crypto-js';
import ReactQuill from 'react-quill';
import * as XLSX from 'xlsx';
import FileSaver from 'file-saver';
import moment from 'moment';
import JSZip from 'jszip';

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
  const [backupEnabled, setBackupEnabled] = useState(false); // State for backup preference
  const [searchTerm, setSearchTerm] = useState(''); // State for search functionality
  const [sortOrder, setSortOrder] = useState('newest'); // State for sorting preference (default: newest)
  const [backupList, setBackupList] = useState([]); // State to store list of backups
  const [showBackupPanel, setShowBackupPanel] = useState(false); // State to toggle backup panel
  
  const videoRef = useRef(null); // Reference for the video element
  const cameraStream = useRef(null); // Reference to store camera stream

  useEffect(() => {
    const checkSession = async () => {
      // First check if we have an active Supabase Auth session
      let authUser = null;
      let customUser = null;
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error fetching auth session:', error);
        } else if (session?.user) {
          // console.log('Active Supabase Auth session found with ID:', session.user.id);
          authUser = session.user;
        }
      } catch (sessionErr) { 
        console.error('Error checking auth session:', sessionErr);
      }
      
      // Check local storage for persisted user
      try {
        const persistedUser = localStorage.getItem('user');
        if (persistedUser) {
          customUser = JSON.parse(persistedUser);
          // console.log('Found persisted user with ID:', customUser.id);
        }
      } catch (parseErr) {
        console.error('Error parsing persisted user:', parseErr);
        localStorage.removeItem('user'); // Clear invalid data
      }
      
      // Decide which user to use based on what we found
      let activeUser = null;
      
      // If we have both, make sure auth user ID is the one that's used
      if (authUser && customUser) {
        // console.log('Found both auth user and custom user, using auth user ID');
        activeUser = {
          ...customUser,
          id: authUser.id, // Use the Auth ID for database operations
          auth_user_id: authUser.id
        };
      } else if (authUser) {
        // Just use the auth user if that's all we have
        // console.log('Using Supabase Auth user only');
        activeUser = authUser;
      } else if (customUser) {
        // Fall back to the custom user if no auth user
        // console.log('No auth session found, using persisted custom user only');
        activeUser = customUser;
      }
      
      // Set the active user and start loading data
      if (activeUser) {
        // console.log('Setting active user with ID:', activeUser.id);
        
        // Update localStorage with the merged user for consistency
        localStorage.setItem('user', JSON.stringify(activeUser));
        
        // Set user in state
        setUser(activeUser);
        
        // Load backup preferences from user_preferences table
        const { data: userPrefs, error: prefsError } = await supabase
          .from('user_preferences')
          .select('backup_enabled')
          .eq('id', activeUser.id)
          .single();
          
        if (!prefsError && userPrefs) {
          setBackupEnabled(userPrefs.backup_enabled || false);
        } else if (prefsError) {
          console.error('Error loading user preferences:', prefsError);
          // Create preference record if it doesn't exist
          try {
            await supabase
              .from('user_preferences')
              .insert([{ id: activeUser.id, backup_enabled: false }]);
          } catch (prefInsertErr) {
            console.error('Error creating user preferences:', prefInsertErr);
          }
        }
        
        // Fetch notes and backups
        fetchNotes(); 
        fetchBackups();
      } else {
        // console.log('No user session found, user needs to log in');
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
        // console.log('Window resized or device orientation changed while camera active');
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

  useEffect(() => {
    // Set up backup check when app loads
    const checkForBackup = async () => {
      if (!user || !backupEnabled) return;
      
      try {
        // Get the last backup date for this user
        const { data: userPrefs, error } = await supabase
          .from('user_preferences')
          .select('last_backup_date')
          .eq('id', user.id)
          .single();
          
        if (error) {
          console.error("Error checking backup status:", error);
          return;
        }
        
        const lastBackupDate = userPrefs?.last_backup_date ? new Date(userPrefs.last_backup_date) : null;
        const now = new Date();
        
        // If no backup has been done yet or it's been over 24 hours
        if (!lastBackupDate || (now - lastBackupDate) > (24 * 60 * 60 * 1000)) {
          // console.log("Performing scheduled backup check");
          
          // Only perform backup if there are notes to back up
          if (notes.length > 0) {
            const success = await performAutoBackup();
            
            // Update last backup date if successful
            if (success) {
              await supabase
                .from('user_preferences')
                .update({ last_backup_date: now.toISOString() })
                .eq('id', user.id);
            }
          }
        } else {
          // console.log("Backup not needed yet. Last backup was:", lastBackupDate);
        }
      } catch (err) {
        console.error("Error in backup scheduling:", err);
      }
    };
    
    // Run backup check when the component mounts with delay to ensure notes are loaded
    if (user && backupEnabled) {
      const timer = setTimeout(() => {
        checkForBackup();
      }, 5000); // 5 second delay
      
      return () => clearTimeout(timer); // Clean up
    }
  }, [user, backupEnabled, notes]);

  // Fetch notes from Supabase
  const fetchNotes = async () => {
    if (!user) return; // Only fetch notes if a user is logged in
    
    // Get the correct auth user ID
    let authUserId = null;
    try {
      // First check if we have an active Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.id) {
        // Use the auth user ID for fetching notes
        authUserId = session.user.id;
        // console.log("Using Supabase auth ID for fetching notes:", authUserId);
      } else {
        // If no active session, fall back to stored user ID
        // console.log("No active auth session, falling back to user ID:", user.id);
        authUserId = user.id;
      }
    } catch (sessionErr) {
      console.error("Error checking auth session:", sessionErr);
      // Fall back to user ID if we can't get the session
      authUserId = user.id;
    }
    
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', authUserId) // Use the auth user ID to filter notes
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notes:', error);
      
      // Check for foreign key or policy issues
      if (error.code === '42501' || error.code === 'PGRST116') {
        console.error("Permission denied when fetching notes. RLS policies may be incorrectly configured.");
      }
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
      // console.log('Gemini AI Response:', response.data);
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
      
      // Ensure the component is in a state where it can access the camera
      if (!isCameraActive && !showHistory) {
        // console.log('Preparing to activate camera');
      } else if (showHistory) {
        console.warn('Cannot activate camera while in history view');
        return; // Don't activate camera in history view
      }
      
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser');
      }
      
      // Set isCameraActive to true before accessing camera
      // This will cause the video element to be rendered in the DOM
      setIsCameraActive(true);
      
      // Wait a moment for the DOM to update with the video element
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if video element is available after state update
      if (!videoRef.current) {
        throw new Error('Video element reference is not available');
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
      
      // console.log('Requesting camera access with constraints:', constraints);
      
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
        
        try {
          stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          // console.log('Camera accessed with fallback constraints');
        } catch (fallbackError) {
          console.error('Failed with fallback constraints:', fallbackError);
          throw new Error('Could not access any camera: ' + fallbackError.message);
        }
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
          // console.log('Video metadata loaded, attempting to play');
          try {
            // Using play() with a timeout to ensure it's ready
            setTimeout(() => {
              if (videoRef.current) {
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                  playPromise.catch(err => {
                    console.error("Error playing video:", err);
                    alert("Could not start video playback. Please try again.");
                    stopCamera(); // Close camera on playback error
                  });
                }
              }
            }, 100);
          } catch (err) {
            console.error("Error in play handler:", err);
            stopCamera(); // Close camera on playback error
          }
        };
        
        // Add a timeout as a fallback if metadata event doesn't fire
        setTimeout(() => {
          if (videoRef.current && videoRef.current.srcObject && !videoRef.current.playing) {
            // console.log('Metadata event did not fire, trying to play video directly');
            videoRef.current.play().catch(err => {
              console.error("Error in fallback play:", err);
              stopCamera(); // Close camera on playback error
            });
          }
        }, 1000);
        
        // console.log("Camera activated successfully");
      } else {
        throw new Error('Video element reference is not available after state update');
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      
      // Make sure we stop any partial stream that might have been created
      if (cameraStream.current) {
        stopCamera();
      }
      
      alert('Error accessing camera: ' + err.message);
      setIsCameraActive(false);
    }
  };
  
  // Take a picture from the camera
  const takePicture = () => {
    try {
      if (!videoRef.current) {
        console.error("Video element not available");
        alert("Cannot access camera view. Please try again.");
        stopCamera(); // Ensure camera is closed
        return;
      }
      
      if (!videoRef.current.srcObject) {
        console.error("Video stream not available");
        alert("Camera stream not active. Please restart the camera.");
        stopCamera(); // Ensure camera is closed
        return;
      }
      
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
          stopCamera(); // Ensure camera is closed
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
        stopCamera(); // Ensure camera is closed
        return;
      }
      
      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0, width, height);
      
      // Convert canvas to blob with error handling
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
          
          // console.log("Picture taken successfully");
        } else {
          console.error("Failed to create image blob");
          alert("Failed to process image. Please try again.");
          stopCamera(); // Ensure camera is closed
        }
      }, 'image/jpeg', 0.9);
    } catch (err) {
      console.error("Error taking picture:", err);
      alert("Error taking picture: " + err.message);
      stopCamera(); // Ensure camera is closed
    }
  };
  
  // Stop camera
  const stopCamera = () => {
    // console.log("Stopping camera");
    try {
      if (cameraStream.current) {
        const tracks = cameraStream.current.getTracks();
        // console.log(`Stopping ${tracks.length} camera tracks`);
        
        tracks.forEach(track => {
          try {
            track.stop();
            // console.log(`Track ${track.id} stopped successfully`);
          } catch (trackErr) {
            console.error(`Error stopping track ${track.id}:`, trackErr);
          }
        });
        
        cameraStream.current = null;
      } else {
        // console.log("No camera stream to stop");
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.onloadedmetadata = null; // Remove event listener
        // console.log("Video source cleared");
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
    
    // Get the correct auth user ID
    let authUserId = null;
    try {
      // First check if we have an active Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.id) {
        // Use the auth user ID for the note
        authUserId = session.user.id;
        // console.log("Using Supabase auth ID for saving note:", authUserId);
      } else {
        // If no active session, fall back to stored user ID
        // console.log("No active auth session, falling back to user ID:", user.id);
        authUserId = user.id;
      }
    } catch (sessionErr) {
      console.error("Error checking auth session:", sessionErr);
      // Fall back to user ID if we can't get the session
      authUserId = user.id;
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
          user_id: authUserId,  // Use the auth user ID instead of user.id
        })
        .eq('id', editingId);

      if (error) {
        console.error("Error updating note:", error);
        
        if (error.code === '23503' || error.message?.includes("violates foreign key constraint")) {
          alert("Authentication error: Your account is not properly linked with Supabase Auth. Please log out and sign up again with an email address.");
        } else {
          alert('Error updating note: ' + error.message);
        }
        return;
      }

      // Delete old image if it was replaced or removed
      if (oldImageUrl && oldImageUrl !== imageUrlToSave && oldImageUrl.includes('storage.supabaseusercontent')) {
        try {
          // Extract the file path from the URL
          const oldImagePath = oldImageUrl.split('/').pop();
          
          if (oldImagePath) {
            // console.log('Attempting to delete old image:', oldImagePath);
            const { error: storageError } = await supabase.storage
              .from('notes-images')
              .remove([oldImagePath]);

            if (storageError) {
              console.error('Error deleting old image from storage:', storageError);
            } else {
              // console.log('Old image deleted successfully from storage');
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
          user_id: authUserId,  // Use the auth user ID instead of user.id
        }]);
      if (error) {
        console.error("Error creating note:", error);
        
        if (error.code === '23503' || error.message?.includes("violates foreign key constraint")) {
          alert("Authentication error: Your account is not properly linked with Supabase Auth. Please log out and sign up again with an email address.");
        } else {
          alert('Error creating note: ' + error.message);
        }
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
      await deleteNote(id);
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
      // Get the note to retrieve the image URL and content
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select('image_url, content')
        .eq('id', id)
        .single();

      if (noteError) {
        alert('Error getting note: ' + noteError.message);
        return;
      }

      const imageUrl = noteData?.image_url;
      const noteContent = noteData?.content;
      let imagesToDelete = [];

      // Add attached image to deletion list if it exists
      if (imageUrl && imageUrl.includes('storage.supabaseusercontent')) {
        try {
          // Extract the file path from the URL
          const urlParts = imageUrl.split('/');
          const imagePath = urlParts[urlParts.length - 1];
          
          if (imagePath) {
            imagesToDelete.push(imagePath);
          }
        } catch (err) {
          console.error('Error processing attached image path:', err);
        }
      }

      // Extract and add embedded images from content to deletion list
      if (noteContent) {
        try {
          // Decrypt the content to get the HTML
          const decryptedContent = decryptData(noteContent);
          
          // Create a temp div to parse HTML
          const div = document.createElement('div');
          div.innerHTML = decryptedContent;
          
          // Find all images in the content
          const contentImages = div.querySelectorAll('img');
          
          for (let i = 0; i < contentImages.length; i++) {
            const imgElement = contentImages[i];
            const imgSrc = imgElement.src;
            
            if (imgSrc && imgSrc.includes('storage.supabaseusercontent')) {
              const urlParts = imgSrc.split('/');
              const imagePath = urlParts[urlParts.length - 1];
              
              if (imagePath && !imagesToDelete.includes(imagePath)) {
                imagesToDelete.push(imagePath);
              }
            }
          }
        } catch (err) {
          console.error('Error extracting embedded images from content:', err);
        }
      }

      // Delete the note
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Error deleting note: ' + error.message);
        return;
      }

      // Delete the images from storage if any exist
      if (imagesToDelete.length > 0) {
        try {
          const { error: storageError } = await supabase.storage
            .from('notes-images')
            .remove(imagesToDelete);

          if (storageError) {
            console.error('Error deleting images from storage:', storageError);
          } else {
            console.log(`${imagesToDelete.length} images deleted from storage`);
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
    try {
      // First, try to authenticate with Supabase Auth if email is provided
      if (username.includes('@')) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: username,
          password: password
        });
        
        if (!authError && authData?.user) {
          // Store credentials securely for potential session refresh
          try {
            localStorage.setItem('userCredentials', JSON.stringify({
              email: username,
              password: password // Ideally encrypt this or use a token approach
            }));
          } catch (e) {
            console.error("Could not store credentials:", e);
          }
          
          // Store user data in localStorage for persistence between page reloads
          localStorage.setItem('user', JSON.stringify(authData.user));
          setUser(authData.user); // Set the logged-in user
          await fetchNotes(); // Fetch notes for the logged-in user
          return;
        }
      }
      
      // Fall back to custom users table if Supabase Auth fails or username is not an email
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
        // Store credentials securely for potential session refresh
        try {
          localStorage.setItem('userCredentials', JSON.stringify({
            username: username,
            password: password // Ideally encrypt this or use a token approach
          }));
        } catch (e) {
          console.error("Could not store credentials:", e);
        }
        
        // Store user data in localStorage for persistence between page reloads
        localStorage.setItem('user', JSON.stringify(data));
        setUser(data); // Set the logged-in user
        await fetchNotes(); // Fetch notes for the logged-in user
      } else {
        setError('Login error: Incorrect password.');
      }
    } catch (err) {
      console.error("Login error:", err);
      setError('Login error: ' + (err.message || 'Unknown error'));
    }
  };

  // Function to handle user sign-up
  const handleSignUp = async () => {
    try {
      // Validate inputs
      if (!username || !password) {
        setError('Please provide both username and email/password');
        return;
      }
      
      // Check if the username is an email address
      const isEmail = username.includes('@');
      let userId = null;
      let authUser = null;
      
      // First, try to register with Supabase Auth if email is provided
      if (isEmail) {
        // Sign up with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: username,
          password: password,
          options: {
            data: {
              username: username.split('@')[0] // Use part before @ as username
            }
          }
        });
        
        if (authError) {
          console.error("Supabase Auth signup error:", authError);
          setError('Sign-up error: ' + authError.message);
          return;
        }
        
        if (authData?.user) {
          // Store the auth user ID
          userId = authData.user.id;
          authUser = authData.user;
          // console.log("Successfully created auth user with ID:", userId);
          
          // Store credentials securely for potential session refresh
          try {
            localStorage.setItem('userCredentials', JSON.stringify({
              email: username,
              password: password
            }));
          } catch (e) {
            console.error("Could not store credentials:", e);
          }
        } else {
          console.warn("No auth user returned from signup");
        }
      }
      
      // Hash password for custom users table
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Insert into custom users table
      const userData = { 
        username, 
        password: hashedPassword
      };
      
      // If we have an auth user ID, associate it with this user
      if (userId) {
        userData.auth_user_id = userId;
      }
      
      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select();

      if (error) {
        // If error, try to clean up auth user if it was created
        if (authUser) {
          // Note: can't actually delete auth users through API, but we can flag them
          console.error("Error creating custom user, but auth user was created:", authUser.id);
        }
        
        setError('Sign-up error: ' + error.message);
        return;
      }

      if (data && data.length > 0) {
        const userRecord = data[0];
        
        // If we have an auth user, use that for RLS policies
        if (authUser) {
          // Store auth user in localStorage
          localStorage.setItem('user', JSON.stringify({
            ...userRecord,
            id: authUser.id // Use auth user ID for database operations
          }));
          setUser({
            ...userRecord,
            id: authUser.id // Use auth user ID for database operations
          });
        } else {
          // No auth user, just use the custom user
          localStorage.setItem('user', JSON.stringify(userRecord));
          setUser(userRecord);
          
          // For non-email users, store credentials differently
          try {
            localStorage.setItem('userCredentials', JSON.stringify({
              username: username,
              password: password
            }));
          } catch (e) {
            console.error("Could not store credentials:", e);
          }
          
          // Warn that some features might not work
          alert('Sign-up successful! Note: Online backup feature requires signing up with an email address.');
        }
        
        await fetchNotes(); // Fetch notes for the new user
        if (authUser) {
          alert('Sign-up successful! Your account is fully set up with all features enabled.');
        }
      } else {
        setError('Sign-up error: No user data returned.');
      }
    } catch (err) {
      console.error("Sign-up error:", err);
      setError('Sign-up error: ' + (err.message || 'Unknown error'));
    }
  };

  // Function to handle user logout
  const handleLogout = async () => {
    try {
      // Make sure camera is stopped if active
      if (isCameraActive) {
        stopCamera();
      }
      
      // Clear all authentication data
      await supabase.auth.signOut();
      localStorage.removeItem('user'); // Clear persisted user data
      localStorage.removeItem('userCredentials'); // Clear stored credentials
      
      // Clear application state
      setUser(null); // Clear user state
      setNotes([]); // Clear notes
      setBackupList([]); // Clear backup list
      
      // console.log("Successfully logged out and cleared all credentials");
    } catch (err) {
      console.error("Error during logout:", err);
      
      // Force clear local storage even if signOut fails
      localStorage.removeItem('user');
      localStorage.removeItem('userCredentials');
      setUser(null);
      setNotes([]);
    }
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

  // Function to toggle backup preferences
  const toggleBackupPreference = async () => {
    try {
      const newBackupEnabled = !backupEnabled;
      setBackupEnabled(newBackupEnabled);
      
      // Update user preferences in database
      const { error } = await supabase
        .from('user_preferences')
        .update({ backup_enabled: newBackupEnabled })
        .eq('id', user.id);
        
      if (error) {
        console.error("Error updating backup preferences:", error);
        alert("Error updating backup preferences");
      }
    } catch (err) {
      console.error("Error toggling backup preference:", err);
      alert("Could not update backup preferences");
    }
  };

  // Function to generate Excel file from notes
  const generateExcel = async () => {
    try {
      if (!notes || notes.length === 0) {
        alert("No notes available to export");
        return;
      }
      
      // Create arrays to store data for both worksheets
      const notesData = [];
      const imagesData = [];
      let imageIndex = 0;
      
      // Process each note
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        
        // Decrypt note content
        const decryptedTitle = decryptData(note.title);
        const decryptedContent = decryptData(note.content);
        
        // Remove HTML tags for Excel text content
        const contentWithoutTags = decryptedContent.replace(/<[^>]*>/g, ' ');
        
        // Check for images in the note content (both embedded and attached)
        let imageReferences = '';
        
        // Check for image URL from upload
        if (note.image_url) {
          try {
            // Get the image data
            const { data: imageData, error: imageError } = await supabase
              .storage
              .from('notes-images')
              .download(note.image_url.split('/').pop());
            
            if (imageError) {
              console.error("Error downloading image:", imageError);
            } else if (imageData) {
              // Create a reference to the image in the Images sheet
              imageIndex++;
              imageReferences = `See image #${imageIndex} in Images sheet`;
              
              // Add to images data
              imagesData.push({
                'Image #': imageIndex,
                'Note Title': decryptedTitle,
                'Image Type': 'Attached Image',
                'Note Created': moment(note.created_at).format('YYYY-MM-DD HH:mm:ss')
              });
            }
          } catch (imgErr) {
            console.error("Error processing attached image:", imgErr);
          }
        }
        
        // Extract embedded images from HTML content
        try {
          // Create a temp div to parse HTML
          const div = document.createElement('div');
          div.innerHTML = decryptedContent;
          
          // Find all images in the content
          const contentImages = div.querySelectorAll('img');
          
          for (let j = 0; j < contentImages.length; j++) {
            const imgElement = contentImages[j];
            const imgSrc = imgElement.src;
            
            if (imgSrc) {
              // Create a reference to the image in the Images sheet
              imageIndex++;
              
              // Add to the reference string
              if (imageReferences) {
                imageReferences += `, #${imageIndex}`;
              } else {
                imageReferences = `See image #${imageIndex} in Images sheet`;
              }
              
              // Add to images data
              imagesData.push({
                'Image #': imageIndex,
                'Note Title': decryptedTitle,
                'Image Type': 'Embedded in Content',
                'Note Created': moment(note.created_at).format('YYYY-MM-DD HH:mm:ss')
              });
            }
          }
        } catch (parseErr) {
          console.error("Error parsing HTML content for images:", parseErr);
        }
        
        // Add note data to the main worksheet
        notesData.push({
          'Title': decryptedTitle,
          'Content': contentWithoutTags,
          'Created': moment(note.created_at).format('YYYY-MM-DD HH:mm:ss'),
          'Updated': moment(note.updated_at).format('YYYY-MM-DD HH:mm:ss'),
          'Images': imageReferences || 'No images'
        });
      }
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      
      // Add notes worksheet
      const notesWorksheet = XLSX.utils.json_to_sheet(notesData);
      XLSX.utils.book_append_sheet(workbook, notesWorksheet, "Notes");
      
      // Add images worksheet if we have any images
      if (imagesData.length > 0) {
        const imagesWorksheet = XLSX.utils.json_to_sheet(imagesData);
        XLSX.utils.book_append_sheet(workbook, imagesWorksheet, "Images");
      }
      
      // Generate file name with timestamp
      const fileName = `notes_backup_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
      
      // Write to file and download
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      FileSaver.saveAs(data, fileName);
      
      // If we have images, also create a zip file with images
      if (imagesData.length > 0) {
        alert(`Excel file downloaded. Note that images are only referenced in this Excel file. To include actual image files with your export, please use the 'Export with Images' option. (${imagesData.length} images detected)`);
      } else {
        alert("Excel backup downloaded successfully");
      }
    } catch (err) {
      console.error("Error generating Excel:", err);
      alert("Failed to generate Excel backup");
    }
  };
  
  // Function to store backup in Supabase
  const storeBackupOnline = async (backupName = '') => {
    try {
      // Check if there are notes to backup
      if (!notes || notes.length === 0) {
        alert("No notes available to backup");
        return false;
      }
      
      // Ensure user is authenticated
      if (!user || !user.id) {
        console.error("User not authenticated properly");
        alert("Authentication error: Please log out and log back in");
        return false;
      }
      
      // If no name provided, generate one
      if (!backupName) {
        backupName = `Backup ${moment().format('YYYY-MM-DD HH:mm')}`;
      }
      
      // Create backup data (encrypt sensitive data)
      const backupData = {
        notes: notes.map(note => ({
          ...note,
          // Don't re-encrypt already encrypted data
          title: note.title, 
          content: note.content
        })),
        timestamp: new Date().toISOString(),
        note_count: notes.length
      };
      
      // console.log("Attempting to store backup with user_id:", user.id);
      
      // Get the actual auth user ID from Supabase
      let authUserId = null;
      try {
        // Get the current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.id) {
          // Use the auth user ID for the backup
          authUserId = session.user.id;
          // console.log("Using Supabase auth ID for backup:", authUserId);
        } else {
          // console.log("No auth session found, trying to sign in with stored credentials");
          
          // Try to sign in with stored credentials to get a valid auth ID
          const storedCredentials = localStorage.getItem('userCredentials');
          if (storedCredentials) {
            try {
              const creds = JSON.parse(storedCredentials);
              
              if (creds.email && creds.password) {
                // Try to sign in with email/password
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                  email: creds.email,
                  password: creds.password
                });
                
                if (!signInError && signInData?.user?.id) {
                  authUserId = signInData.user.id;
                  // console.log("Re-authenticated successfully, using auth ID:", authUserId);
                }
              }
            } catch (credError) {
              console.error("Error processing stored credentials:", credError);
            }
          }
          
          // If still no auth ID, we need to handle this differently
          if (!authUserId) {
            alert("Authentication error: Your account is not properly linked with Supabase Auth. Please contact support or sign up with an email address.");
            return false;
          }
        }
      } catch (sessionErr) {
        console.error("Error getting auth session:", sessionErr);
        alert("Failed to authenticate with Supabase. Please log out and log back in.");
        return false;
      }
      
      // Store in Supabase with more detailed error handling
      const { data, error } = await supabase
        .from('note_backups')
        .insert([{
          user_id: authUserId, // Use the authenticated user ID from Supabase Auth
          backup_data: backupData,
          backup_type: 'manual',
          backup_name: backupName,
          is_deleted: false,
          backup_date: new Date().toISOString()
        }])
        .select();
        
      if (error) {
        console.error("Error storing backup:", error);
        
        // More specific error messages
        if (error.code === '42501' || error.code === 'PGRST116') {
          alert("Permission denied. Your account doesn't have permission to create backups. This may be due to a Row Level Security policy issue.");
        } else if (error.code === '23505') {
          alert("A backup with the same date already exists. Please try again in a moment.");
        } else if (error.code === '23503' || error.message?.includes("violates foreign key constraint")) {
          // Handle foreign key constraint specifically
          alert("Error: Your user account is not properly registered in the Supabase authentication system. Please log out, then sign up again using your email address.");
          return false;
        } else if (error.status === 401 || error.code === 'PGRST301') {
          // If we get a 401, we might need to re-authenticate the user
          alert("Authentication error: Your session has expired. Please log out and log back in to refresh your authentication.");
          return false;
        } else {
          alert(`Error storing backup: ${error.message || 'Unknown error'}`);
        }
        return false;
      }
      
      if (!data || data.length === 0) {
        console.error("No data returned from backup insertion");
        alert("Backup may not have been stored correctly");
        return false;
      }
      
      // console.log("Backup stored successfully:", data);
      alert("Backup stored online successfully");
      fetchBackups(); // Refresh backup list
      return true;
    } catch (err) {
      console.error("Error storing backup:", err);
      alert("Failed to store backup online: " + (err.message || 'Unknown error'));
      return false;
    }
  };
  
  // Function to fetch user's backups
  const fetchBackups = async () => {
    try {
      // Check if user is logged in
      if (!user || !user.id) {
        // console.log("No user logged in, skipping backup fetch");
        return;
      }
      
      // console.log("Fetching backups for user ID:", user.id);
      
      // Attempt to fetch backups
      const { data, error } = await supabase
        .from('note_backups')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('backup_date', { ascending: false });
        
      if (error) {
        console.error("Error fetching backups:", error);
        // Don't show alert to user as this might be called in the background
        return;
      }
      
      // console.log(`Successfully fetched ${data?.length || 0} backups`);
      setBackupList(data || []);
    } catch (err) {
      console.error("Error fetching backups:", err);
    }
  };
  
  // Automatic backup function (to be called nightly or on conditions)
  const performAutoBackup = async () => {
    try {
      // Only perform if user has enabled backups
      if (!backupEnabled || !user) {
        // console.log("Auto backup skipped: disabled or no user");
        return false;
      }
      
      // Check if there are new notes since last backup
      const lastBackup = backupList[0]; // Most recent backup
      
      if (lastBackup) {
        // Find most recent note update
        const latestNoteUpdate = notes.reduce((latest, note) => {
          const noteDate = new Date(note.updated_at);
          return noteDate > latest ? noteDate : latest;
        }, new Date(0));
        
        // Compare with last backup date
        const lastBackupDate = new Date(lastBackup.backup_date);
        
        // If no new updates, skip backup
        if (latestNoteUpdate <= lastBackupDate) {
          // console.log("Auto backup skipped: no new updates");
          return false;
        }
      }
      
      // Create backup data
      const backupData = {
        notes: notes.map(note => ({
          ...note,
          // Don't re-encrypt already encrypted data
          title: note.title,
          content: note.content
        })),
        timestamp: new Date().toISOString(),
        note_count: notes.length
      };
      
      // Store in Supabase
      const { error } = await supabase
        .from('note_backups')
        .insert([{
          user_id: user.id,
          backup_data: backupData,
          backup_type: 'auto',
          backup_name: `Auto Backup ${moment().format('YYYY-MM-DD')}`
        }]);
        
      if (error) {
        console.error("Error in auto backup:", error);
        return false;
      }
      
      // console.log("Auto backup completed successfully");
      fetchBackups(); // Refresh backup list
      return true;
    } catch (err) {
      console.error("Error in auto backup:", err);
      return false;
    }
  };
  
  // Function to restore from a backup
  const restoreFromBackup = async (backupId) => {
    try {
      // Confirm with user
      const confirmRestore = window.confirm(
        "This will replace your current notes with the backup. Continue?"
      );
      
      if (!confirmRestore) return;
      
      // Get the specific backup
      const { data: backupData, error: backupError } = await supabase
        .from('note_backups')
        .select('*')
        .eq('id', backupId)
        .single();
        
      if (backupError || !backupData) {
        console.error("Error fetching backup:", backupError);
        alert("Could not retrieve backup data");
        return;
      }
      
      // Extract notes from the backup
      const notesFromBackup = backupData.backup_data.notes;
      
      // Update local state with backup data
      setNotes(notesFromBackup);
      
      alert("Backup restored successfully");
    } catch (err) {
      console.error("Error restoring backup:", err);
      alert("Failed to restore from backup");
    }
  };
  
  // Function to delete a backup
  const deleteBackup = async (backupId) => {
    try {
      const confirmDelete = window.confirm("Are you sure you want to delete this backup?");
      
      if (!confirmDelete) return;
      
      // Mark as deleted instead of actually deleting
      const { error } = await supabase
        .from('note_backups')
        .update({ is_deleted: true })
        .eq('id', backupId);
        
      if (error) {
        console.error("Error deleting backup:", error);
        alert("Could not delete backup");
        return;
      }
      
      // Refresh backup list
      fetchBackups();
      alert("Backup deleted successfully");
    } catch (err) {
      console.error("Error deleting backup:", err);
      alert("Failed to delete backup");
    }
  };

  // Function to export notes with images as a ZIP file
  const exportWithImages = async () => {
    try {
      if (!notes || notes.length === 0) {
        alert("No notes available to export");
        return;
      }
      
      // Show a loading message
      alert("Preparing export with images... This may take a moment.");
      
      // Create a new JSZip instance
      const zip = new JSZip();
      
      // Create arrays to store data for both worksheets
      const notesData = [];
      const imagesData = [];
      let imageIndex = 0;
      const imagesFolder = zip.folder("images");
      
      // Process each note
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        
        // Decrypt note content
        const decryptedTitle = decryptData(note.title);
        const decryptedContent = decryptData(note.content);
        
        // Remove HTML tags for Excel text content
        const contentWithoutTags = decryptedContent.replace(/<[^>]*>/g, ' ');
        
        // Check for images in the note content (both embedded and attached)
        let imageReferences = '';
        
        // Check for image URL from upload
        if (note.image_url) {
          try {
            // Get the image data
            const { data: imageData, error: imageError } = await supabase
              .storage
              .from('notes-images')
              .download(note.image_url.split('/').pop());
            
            if (imageError) {
              console.error("Error downloading image:", imageError);
            } else if (imageData) {
              // Create a reference to the image in the Images sheet
              imageIndex++;
              const fileName = `image_${imageIndex}.jpg`;
              imageReferences = `images/${fileName}`;
              
              // Add the image to the ZIP file
              imagesFolder.file(fileName, imageData);
              
              // Add to images data
              imagesData.push({
                'Image #': imageIndex,
                'Note Title': decryptedTitle,
                'Image Type': 'Attached Image',
                'File Path': `images/${fileName}`,
                'Note Created': moment(note.created_at).format('YYYY-MM-DD HH:mm:ss')
              });
            }
          } catch (imgErr) {
            console.error("Error processing attached image:", imgErr);
          }
        }
        
        // Extract embedded images from HTML content
        try {
          // Create a temp div to parse HTML
          const div = document.createElement('div');
          div.innerHTML = decryptedContent;
          
          // Find all images in the content
          const contentImages = div.querySelectorAll('img');
          
          for (let j = 0; j < contentImages.length; j++) {
            const imgElement = contentImages[j];
            const imgSrc = imgElement.src;
            
            if (imgSrc) {
              try {
                // Fetch the image data
                const response = await fetch(imgSrc);
                const blob = await response.blob();
                
                // Create a reference to the image in the Images sheet
                imageIndex++;
                const fileName = `image_${imageIndex}.jpg`;
                
                // Add to the reference string
                if (imageReferences) {
                  imageReferences += `, images/${fileName}`;
                } else {
                  imageReferences = `images/${fileName}`;
                }
                
                // Add the image to the ZIP file
                imagesFolder.file(fileName, blob);
                
                // Add to images data
                imagesData.push({
                  'Image #': imageIndex,
                  'Note Title': decryptedTitle,
                  'Image Type': 'Embedded in Content',
                  'File Path': `images/${fileName}`,
                  'Note Created': moment(note.created_at).format('YYYY-MM-DD HH:mm:ss')
                });
              } catch (fetchErr) {
                console.error("Error fetching image:", fetchErr);
              }
            }
          }
        } catch (parseErr) {
          console.error("Error parsing HTML content for images:", parseErr);
        }
        
        // Add note data to the main worksheet
        notesData.push({
          'Title': decryptedTitle,
          'Content': contentWithoutTags,
          'Created': moment(note.created_at).format('YYYY-MM-DD HH:mm:ss'),
          'Updated': moment(note.updated_at).format('YYYY-MM-DD HH:mm:ss'),
          'Images': imageReferences || 'No images'
        });
      }
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      
      // Add notes worksheet
      const notesWorksheet = XLSX.utils.json_to_sheet(notesData);
      XLSX.utils.book_append_sheet(workbook, notesWorksheet, "Notes");
      
      // Add images worksheet if we have any images
      if (imagesData.length > 0) {
        const imagesWorksheet = XLSX.utils.json_to_sheet(imagesData);
        XLSX.utils.book_append_sheet(workbook, imagesWorksheet, "Images");
      }
      
      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      
      // Add Excel file to ZIP
      zip.file("notes_data.xlsx", excelBuffer);
      
      // Add a README file explaining the contents
      zip.file("README.txt", 
        "Notes Backup with Images\n\n" +
        "This ZIP file contains:\n" +
        "1. notes_data.xlsx - Excel file with all your notes\n" +
        "2. images/ folder - Contains all images from your notes\n\n" +
        `Generated on: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n` +
        `Total notes: ${notes.length}\n` +
        `Total images: ${imageIndex}\n`
      );
      
      // Generate the ZIP file
      const zipContent = await zip.generateAsync({ type: "blob" });
      
      // Save the ZIP file
      const fileName = `notes_backup_with_images_${moment().format('YYYY-MM-DD_HH-mm-ss')}.zip`;
      FileSaver.saveAs(zipContent, fileName);
      
      alert("Backup with images downloaded successfully as a ZIP file");
    } catch (err) {
      console.error("Error exporting with images:", err);
      alert("Failed to create backup with images: " + err.message);
    }
  };

  // Handle deleting multiple notes at once
  const handleDeleteMultiple = async (noteIds) => {
    if (!noteIds || noteIds.length === 0) {
      alert('No notes selected for deletion');
      return;
    }
    
    try {
      // Get data for all selected notes to extract image URLs
      const { data: notesData, error: fetchError } = await supabase
        .from('notes')
        .select('id, image_url, content')
        .in('id', noteIds);
        
      if (fetchError) {
        console.error('Error fetching notes for deletion:', fetchError);
        alert('Error preparing notes for deletion');
        return;
      }
      
      // Process all notes to extract images
      let allImagesToDelete = [];
      
      for (let note of notesData) {
        // Extract attached image
        if (note.image_url && note.image_url.includes('storage.supabaseusercontent')) {
          try {
            const urlParts = note.image_url.split('/');
            const imagePath = urlParts[urlParts.length - 1];
            
            if (imagePath && !allImagesToDelete.includes(imagePath)) {
              allImagesToDelete.push(imagePath);
            }
          } catch (err) {
            console.error('Error processing attached image path:', err);
          }
        }
        
        // Extract embedded images from content
        if (note.content) {
          try {
            // Decrypt the content to get the HTML
            const decryptedContent = decryptData(note.content);
            
            // Create a temp div to parse HTML
            const div = document.createElement('div');
            div.innerHTML = decryptedContent;
            
            // Find all images in the content
            const contentImages = div.querySelectorAll('img');
            
            for (let i = 0; i < contentImages.length; i++) {
              const imgElement = contentImages[i];
              const imgSrc = imgElement.src;
              
              if (imgSrc && imgSrc.includes('storage.supabaseusercontent')) {
                const urlParts = imgSrc.split('/');
                const imagePath = urlParts[urlParts.length - 1];
                
                if (imagePath && !allImagesToDelete.includes(imagePath)) {
                  allImagesToDelete.push(imagePath);
                }
              }
            }
          } catch (err) {
            console.error('Error extracting embedded images from content:', err);
          }
        }
      }
      
      // Delete all selected notes
      const { error: deleteError } = await supabase
        .from('notes')
        .delete()
        .in('id', noteIds);
        
      if (deleteError) {
        console.error('Error deleting multiple notes:', deleteError);
        alert('Error deleting notes: ' + deleteError.message);
        return;
      }
      
      // Delete all associated images
      if (allImagesToDelete.length > 0) {
        try {
          const { error: storageError } = await supabase.storage
            .from('notes-images')
            .remove(allImagesToDelete);
            
          if (storageError) {
            console.error('Error deleting images from storage:', storageError);
          } else {
            console.log(`${allImagesToDelete.length} images deleted from storage`);
          }
        } catch (err) {
          console.error('Error during batch image deletion:', err);
        }
      }
      
      // Refresh notes
      alert(`Successfully deleted ${noteIds.length} notes and ${allImagesToDelete.length} associated images`);
      fetchNotes();
    } catch (err) {
      console.error('Error in handleDeleteMultiple:', err);
      alert('An error occurred while deleting notes');
    }
  };

  return (
    <div className="container">
      {user ? (
        <div className="dashboard">
          <div className="sidebar">
            <h2>Welcome {user.username}</h2>
            <button className="sidebar-btn history-button" onClick={handleHistory}>
              <FaHistory /> Your Notes
            </button>
            <div className="backup-section">
              <h3>Backup Options</h3>
              <div className="backup-toggle">
                <label>
                  <input 
                    type="checkbox" 
                    checked={backupEnabled} 
                    onChange={toggleBackupPreference} 
                  />
                  Enable Auto Backup
                </label>
              </div>
              <button className="backup-btn" onClick={generateExcel}>
                <FaDownload /> Export to Excel
              </button>
              <button className="backup-btn" onClick={exportWithImages}>
                <FaFileArchive /> Export with Images
              </button>
              <button className="backup-btn" onClick={() => storeBackupOnline()}>
                <FaCloudUploadAlt /> Backup Online
              </button>
              <button className="backup-btn" onClick={() => setShowBackupPanel(!showBackupPanel)}>
                <FaCloudDownloadAlt /> Manage Backups
              </button>
            </div>
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
                    onEditNote={handleEdit}
                    onDeleteNote={handleDelete}
                    onDeleteMultiple={handleDeleteMultiple}
                    decryptData={decryptData}
                  />
                </>
              )
            ) : showBackupPanel ? (
              <>
                <button className="back-to-dashboard" onClick={() => setShowBackupPanel(false)}>
                  <FaArrowLeft /> Back to Dashboard
                </button>
                <div className="backup-panel">
                  <h2>Your Backups</h2>
                  {backupList.length === 0 ? (
                    <p>No backups available yet.</p>
                  ) : (
                    <div className="backup-list">
                      {backupList.map(backup => (
                        <div key={backup.id} className="backup-item">
                          <div className="backup-info">
                            <h3>{backup.backup_name}</h3>
                            <p>Date: {new Date(backup.backup_date).toLocaleString()}</p>
                            <p>Type: {backup.backup_type === 'auto' ? 'Automatic' : 'Manual'}</p>
                            <p>Notes: {backup.backup_data.note_count}</p>
                          </div>
                          <div className="backup-actions">
                            <button onClick={() => restoreFromBackup(backup.id)}>Restore</button>
                            <button onClick={() => deleteBackup(backup.id)}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
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
                        style={{ 
                          width: '100%', 
                          maxHeight: '400px', 
                          background: '#000',
                          display: 'block',
                          borderRadius: '8px',
                          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                        }}
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
                              className="clear-image-btn" 
                              onClick={handleClearImage}
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="image-buttons">
                        <button onClick={pickImage} className="image-btn">
                          <FaImage /> Choose Image
                        </button>
                        <button onClick={activateCamera} className="camera-btn">
                          <FaCamera /> Take Photo
                        </button>
                      </div>
                    </>
                  )}
                  
                  <button onClick={saveNote} className="save-btn">
                    {editingId ? 'Update Note' : 'Save Note'}
                  </button>
                </div>
                
                <div className="view-history-prompt">
                  <p>View and manage your notes in the <strong>Your Notes</strong> section.</p>
                  <button onClick={handleHistory} className="view-history-btn">
                    <FaHistory /> Go to Your Notes
                  </button>
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
