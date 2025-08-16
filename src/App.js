import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import FileSaver from 'file-saver';
import moment from 'moment';
import JSZip from 'jszip';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import CryptoJS from 'crypto-js';
import { FaImage, FaCamera, FaHistory, FaSignOutAlt, FaPlus, FaArrowLeft, FaCloudUploadAlt, FaTrash, FaDownload, FaCloudDownloadAlt, FaFileArchive, FaHdd, FaEye, FaUndo, FaSpinner, FaClone, FaFileAlt } from 'react-icons/fa';
import 'react-quill/dist/quill.snow.css';

import './App.css';
import { supabase } from './supabase/supabaseClient'; 
import PasswordModal from './PasswordModal';
import ImageModal from './ImageModal';
import CustomQuill from './CustomQuill';
import { useResponsiveSidebar } from './hooks/useResponsiveSidebar';
import { formatBytes } from './formatBytes';

// Lazy load heavy components
const NotesHistory = lazy(() => import('./components/NotesHistory'));
const NoteDetail = lazy(() => import('./components/NoteDetail'));

const secretKey = process.env.REACT_APP_SECRET_KEY || 'fallback-secret-key'; // Get the secret key from environment variables

// Function to encrypt data
function encryptData(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), secretKey).toString();
}

// Function to decrypt data
function decryptData(ciphertext) {
  try {
    // Check if the data is encrypted by looking for a specific pattern or prefix
    if (!ciphertext || !ciphertext.startsWith('U2FsdGVkX1')) {
      // Assuming 'U2FsdGVkX1' is a common prefix for encrypted data
      return ciphertext; // Return the original data if it's not encrypted
    }

    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedData) {
      throw new Error('Decrypted data is empty');
    }

    return JSON.parse(decryptedData); // Ensure the decrypted data is parsed correctly
  } catch (error) {
    console.error('Decryption error:', error);
    return ciphertext; // Return the original data if decryption fails
  }
}

export default function App() {

  const [user, setUser] = useState(null); // New state to track the logged-in user
  
  // Responsive sidebar hook
  const { 
    isSidebarVisible, 
    isMobile, 
    toggleSidebar, 
    showSidebarTemporarily 
  } = useResponsiveSidebar(5000); // 5 second auto-hide delay
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
  const [email, setEmail] = useState(''); // Renamed from username to email for clarity
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
  const [userStorage, setUserStorage] = useState({
    used: 0,
    total: 500 * 1024 * 1024, // 500MB in bytes
    unlimited: false
  });
  const [lastActivity, setLastActivity] = useState(Date.now());
  
  const videoRef = useRef(null); // Reference for the video element
  const cameraStream = useRef(null); // Reference to store camera stream

  // Add this state for password reset
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [resetError, setResetError] = useState('');

  // Add state variables to manage backup viewing
  const [viewingBackup, setViewingBackup] = useState(null);
  const [backupDetails, setBackupDetails] = useState([]);

  // Add these state variables inside your component
  const [isProcessingDuplicates, setIsProcessingDuplicates] = useState(false);

  // Add a ref for the editor
  const editorRef = useRef(null);

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

  useEffect(() => {
    // Fetch backups when the component mounts
    if (user) {
      fetchBackups();
    }
  }, [user]);

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
      // Generate a unique file name
      const fileName = `${uuidv4()}-${file.name}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('notes-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
        
      if (error) {
        throw error;
      }
      
      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('notes-images')
        .getPublicUrl(fileName);
        
      const publicUrl = urlData.publicUrl;
      
      // Set the image URL state without encryption (will be encrypted when saving)
      setImageUrl(publicUrl);
      
      return publicUrl;
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Failed to upload image');
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

  // Update the calculateUserStorage function to be more accurate
  const calculateUserStorage = async () => {
    if (!user) return;

    try {
      // Check if user has unlimited storage
      const isUnlimited = user.email === "ghugev7@gmail.com";
      
      // Get all notes for the user
      const { data: userNotes, error } = await supabase
        .from('notes')
        .select('content, image_url')
        .eq('user_id', user.id);

      if (error) throw error;

      // Calculate total storage used
      let totalSize = 0;
      for (const note of userNotes) {
        // Calculate size of note content
        if (note.content) {
          totalSize += new Blob([note.content]).size;
        }
        
        // Calculate size of attached images
        if (note.image_url) {
          try {
            const response = await fetch(note.image_url, { method: 'HEAD' });
            const size = parseInt(response.headers.get('content-length') || '0');
            totalSize += size;
          } catch (err) {
            console.error('Error calculating image size:', err);
          }
        }
      }

      setUserStorage({
        used: totalSize,
        total: 500 * 1024 * 1024, // 500MB in bytes
        unlimited: isUnlimited
      });

      return totalSize;
    } catch (err) {
      console.error('Error calculating storage:', err);
      return 0;
    }
  };

  // Update the saveNote function to encrypt data before saving
  const saveNote = async () => {
    try {
      if (!title.trim()) {
        alert('Please add a title to your note');
        return;
      }
      
      if (!content.trim()) {
        alert('Please add content to your note');
        return;
      }

      // Calculate size of content for storage tracking
      const contentSize = new Blob([content]).size;
      let imageSize = 0;

      // Calculate size of image if exists
      if (imageUrl) {
        try {
          const response = await fetch(imageUrl, { method: 'HEAD' });
          imageSize = parseInt(response.headers.get('content-length') || '0');
        } catch (err) {
          console.error('Error calculating image size:', err);
        }
      }

      // Encrypt data before storing
      const encryptedTitle = encryptData(title);
      const encryptedContent = encryptData(content);
      // Only encrypt image_url if it exists
      const encryptedImageUrl = imageUrl ? encryptData(imageUrl) : null;

      // Check if editing an existing note
      if (editingId) {
        // Update the existing note with encrypted data
        const { error } = await supabase
          .from('notes')
          .update({
            title: encryptedTitle,
            content: encryptedContent,
            image_url: encryptedImageUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) {
          console.error('Error updating note:', error);
          alert('Failed to update note: ' + error.message);
          return;
        }

        // Clear the form and refresh notes
        setTitle('');
        setContent('');
        setImageUrl(null);
        setEditingId(null);
        await fetchNotes();
        alert('Note updated successfully!');
      } else {
        // Create a new note with encrypted data
        const { error } = await supabase
          .from('notes')
          .insert([
            {
              title: encryptedTitle,
              content: encryptedContent,
              image_url: encryptedImageUrl,
              user_id: user.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]);

        if (error) {
          console.error('Error creating note:', error);
          alert('Failed to create note: ' + error.message);
          return;
        }

        // Clear the form and refresh notes
        setTitle('');
        setContent('');
        setImageUrl(null);
        await fetchNotes();
        alert('Note saved successfully!');
      }
    } catch (err) {
      console.error('Error saving note:', err);
      alert('An error occurred. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this note?");
    if (confirmDelete) {
      await deleteNote(id);
    }
  };

  const handleEdit = (note) => {
    const confirmEdit = window.confirm("Are you sure you want to edit this note?");
    if (confirmEdit) {
      try {
        setTitle(decryptData(note.title)); // Set the title for editing
        setContent(decryptData(note.content)); // Set the content for editing
        setEditingId(note.id); // Set the ID of the note being edited
        
        // Decrypt image URL if it exists
        if (note.image_url) {
          try {
            const decryptedImageUrl = decryptData(note.image_url);
            // console.log('Decrypted image URL for editing:', decryptedImageUrl);
            setImageUrl(decryptedImageUrl);
          } catch (imgError) {
            console.error('Error decrypting image URL for editing:', imgError);
            setImageUrl(null); // Clear image URL if decryption fails
          }
        } else {
          setImageUrl(null);
        }
        
        setShowHistory(false); // Hide history view when editing
      } catch (error) {
        console.error('Error preparing note for editing:', error);
        alert('Failed to edit note. Please try again.');
      }
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
        // Use the existing logic from handleEdit
        const note = noteToEdit; // Assuming noteToEdit is set correctly
        setTitle(decryptData(note.title)); // Set the title for editing
        setContent(decryptData(note.content)); // Set the content for editing
        setEditingId(note.id); // Set the ID of the note being edited
        setImageUrl(note.image_url); // Set the image URL if it exists
        setShowHistory(false); // Hide history view when editing
    }

    setShowModal(false);
  };

  // Function to delete an image from Supabase Storage
  async function deleteImage(imageUrl) {
    try {
        const urlParts = imageUrl.split('/');
        const imagePath = urlParts[urlParts.length - 1]; // Extract the last part of the URL as the file path
        // console.log('Attempting to delete image:', imagePath);

        const { error } = await supabase.storage
            .from('notes-images')
            .remove([imagePath]); // Directly remove the image using its path

        if (error) {
            console.error('Error deleting image from storage:', error);
            alert('Failed to delete image from storage.');
        } else {
            // console.log('Image successfully deleted from storage.');
            alert('Image deleted successfully.');
        }
    } catch (err) {
        console.error('Error during image deletion:', err);
        alert('An error occurred while deleting the image.');
    }
  }

  // Modify the deleteNote function
  async function deleteNote(id) {
    try {
        // console.log('deleteNote function called with ID:', id);

        // Get the note to retrieve the image URL and content
        const { data: noteData, error: noteError } = await supabase
            .from('notes')
            .select('image_url, content')
            .eq('id', id)
            .single();

        if (noteError) {
            console.error('Error getting note:', noteError);
            alert('Error getting note: ' + noteError.message);
            return;
        }

        // console.log('Note data retrieved:', noteData);

        // Decrypt the image URL
        const imageUrl = noteData?.image_url ? decryptData(noteData.image_url) : null;
        // console.log('Decrypted Image URL:', imageUrl);

        // If the image URL is valid and points to Supabase storage, delete the image first
        if (imageUrl && imageUrl.includes('storage/v1/object/public/notes-images/')) {
            // console.log('Attempting to delete image:', imageUrl);
            const urlParts = imageUrl.split('/');
            const imagePath = urlParts[urlParts.length - 1]; // Extract the last part of the URL as the file path

            const { error: storageError } = await supabase.storage
                .from('notes-images')
                .remove([imagePath]); // Directly remove the image using its path

            if (storageError) {
                console.error('Error deleting image from storage:', storageError);
                alert('Failed to delete image from storage.');
            } else {
                // console.log('Image successfully deleted from storage.');
            }
        } else {
            // console.log('Image URL is not valid or does not point to Supabase storage.');
        }

        // Delete the note
        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting note:', error);
            alert('Error deleting note: ' + error.message);
            return;
        }

        // console.log('Note successfully deleted.');
        // Refresh notes without reloading
        refreshNotes();
    } catch (err) {
        console.error('Error in deleteNote function:', err);
        alert('An error occurred while deleting the note. Please try again.');
    }
  }

  // Render a note item with an option to delete the image
  const renderItem = (item) => {
    try {
        // Decrypt the title and content
        const title = decryptData(item.title);
        const content = decryptData(item.content);
        
        // Decrypt the image URL with additional error handling
        let imageUrl = null;
        try {
            if (item.image_url) {
                imageUrl = decryptData(item.image_url);
                // console.log('Successfully decrypted Image URL:', imageUrl);
            }
        } catch (imgError) {
            console.error('Error decrypting image URL:', imgError);
            // Continue rendering without the image if decryption fails
        }

        if (!title || !content) {
            console.error('Title or content decryption failed');
            return null; // Skip rendering if decryption fails
        }

        return (
            <div className="noteCard" key={item.id}>
                <h4>{title}</h4>
                <div className="note-content" dangerouslySetInnerHTML={{ __html: content }}></div>
                {imageUrl && (
                    <div>
                        <img 
                            src={imageUrl} 
                            alt="Note related" 
                            style={{ maxWidth: '100%', height: 'auto' }} 
                            onClick={() => setFullImageUrl(imageUrl)} 
                        />
                        <button onClick={() => deleteImage(imageUrl)} className="delete-image-btn">Delete Image</button>
                    </div>
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
      // Enhanced email validation with regex
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address.');
        return;
      }
      
      // Try to authenticate with Supabase Auth (primary authentication method)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      if (!authError && authData?.user) {
        // Check if the email has been verified
        if (authData.user.email_confirmed_at || process.env.REACT_APP_BYPASS_EMAIL_VERIFICATION === 'true') {
          // Store credentials securely for potential session refresh
          try {
            localStorage.setItem('userCredentials', JSON.stringify({
              email: email,
              password: password
            }));
          } catch (e) {
            console.error("Could not store credentials:", e);
          }
          
          // Store user data in localStorage for persistence between page reloads
          localStorage.setItem('user', JSON.stringify(authData.user));
          setUser(authData.user); // Set the logged-in user
          await fetchNotes(); // Fetch notes for the logged-in user
        } else {
          setError('Please verify your email address before logging in. Check your inbox for the verification link.');
          // Optionally provide a way to resend the verification email
          const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: email
          });
          
          if (!resendError) {
            alert('A new verification email has been sent to your address.');
          }
          
          // Sign out since email isn't verified
          await supabase.auth.signOut();
        }
        return;
      }
      
      // Fall back to custom users table if Supabase Auth fails
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', email) // Username column in database contains email
        .single();

      if (error || !data) {
        setError('Login error: Email not found. Please sign up.');
        return;
      }

      // Compare the entered password with the hashed password in the database
      const isMatch = await bcrypt.compare(password, data.password);
      if (isMatch) {
        // Password matches, proceed with login
        // Rest of the login logic remains the same
        // Store credentials securely for potential session refresh
        try {
          localStorage.setItem('userCredentials', JSON.stringify({
            username: email, // This is now an email
            password: password
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
      if (!email || !password) {
        setError('Please provide both email and password');
        return;
      }
      
      // Enhanced email validation
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        setError('Please provide a valid email address');
        return;
      }

      // Hash the password before storing
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // First, create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password, // Original password for auth system
        options: {
          data: {
            username: email.split('@')[0]
          }
        }
      });

      if (authError) {
        console.error("Auth signup error:", authError);
        setError('Sign-up error: ' + authError.message);
        return;
      }

      if (!authData.user) {
        setError('Sign-up error: No user data returned');
        return;
      }

      // Store the auth user ID
      const userId = authData.user.id;

      // Create user preferences record
      const { error: prefError } = await supabase
        .from('user_preferences')
        .insert([
          { 
            id: userId,
            backup_enabled: false
          }
        ]);

      if (prefError) {
        console.error("Error creating user preferences:", prefError);
      }

      // Store user in local storage
      localStorage.setItem('user', JSON.stringify({
        id: userId,
        email: email,
        auth_user_id: userId
      }));

      // Update application state
      setUser({
        id: userId,
        email: email,
        auth_user_id: userId
      });

      // Enable RLS policy for the new user
      const { error: policyError } = await supabase.rpc('setup_user_security', {
        user_id: userId
      });

      if (policyError) {
        console.error("Error setting up user security:", policyError);
      }

      // Check if email confirmation is required
      if (authData.user?.confirmationSent || !authData.user?.confirmed_at) {
        alert('Sign-up successful! Please check your email to verify your account before logging in.');
        handleLogout();
      } else {
        await fetchNotes();
        alert('Sign-up successful! Your account is ready to use.');
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
    try {
      // Create a copy of the note with decrypted values
      const decryptedNote = {
        ...note,
        title: decryptData(note.title),
        content: decryptData(note.content),
        image_url: note.image_url ? decryptData(note.image_url) : null
      };
      
      // console.log('Viewing note with decrypted image URL:', decryptedNote.image_url);
      setSelectedNote(decryptedNote); // Set the selected note with decrypted values
    } catch (error) {
      console.error('Error decrypting note for viewing:', error);
      alert('Failed to view note. Please try again.');
    }
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
  const storeBackupOnline = async () => {
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

      // Generate a backup name
      const backupName = `Backup ${moment().format('YYYY-MM-DD HH:mm')}`;

      // Create backup data (ensure sensitive data is encrypted)
      const backupData = {
        notes: notes.map(note => ({
          ...note,
          title: note.title, // Assuming title is already encrypted
          content: note.content // Assuming content is already encrypted
        })),
        timestamp: new Date().toISOString(),
        note_count: notes.length
      };

      // Get the actual auth user ID from Supabase
      let authUserId = user.id;

      // Store in Supabase
      const { data, error } = await supabase
        .from('note_backups')
        .insert([{
          user_id: authUserId,
          backup_data: backupData,
          backup_type: 'manual',
          backup_name: backupName,
          is_deleted: false,
          backup_date: new Date().toISOString()
        }])
        .select();

      if (error) {
        console.error("Error storing backup:", error);
        alert(`Error storing backup: ${error.message || 'Unknown error'}`);
        return false;
      }

      if (!data || data.length === 0) {
        console.error("No data returned from backup insertion");
        alert("Backup may not have been stored correctly");
        return false;
      }

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
      // Get the current session to ensure we have the latest user info
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || !session.user || !session.user.id) {
        // console.log("No authenticated session found, skipping backup fetch");
        return;
      }
      
      // Use the session user ID directly from Supabase Auth
      const { data, error } = await supabase
        .from('note_backups')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_deleted', false)
        .order('backup_date', { ascending: false });

      if (error) {
        console.error("Error fetching backups:", error);
        return;
      }

      setBackupList(data || []);
      
      // Log for debugging
      // console.log(`Fetched ${data?.length || 0} backups for user ${session.user.id}`);
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
  
  // Simplified restore function that only offers merging and proper cancellation
  const restoreFromBackup = async (backupId) => {
    try {
      // Find the backup to restore
      const backup = backupList.find(b => b.id === backupId);
      
      if (!backup || !backup.backup_data || !backup.backup_data.notes) {
        alert('Backup data not found or corrupted');
        return;
      }
      
      // Ask if the user wants to restore notes from the backup
      const confirmRestore = window.confirm(
        'Would you like to restore notes from this backup? ' +
        'This will add backup notes to your current notes. ' +
        'Click OK to proceed or Cancel to abort.'
      );
      
      if (!confirmRestore) {
        // User clicked Cancel, simply abort the operation
        return;
      }
      
      // Proceed with merging backup notes with existing notes
      // Get existing note IDs to avoid duplicates
      const existingIds = notes.map(note => note.id);
      
      // Filter backup notes to remove any that have the same ID as existing notes
      const notesToAdd = backup.backup_data.notes.filter(backupNote => 
        !existingIds.includes(backupNote.id)
      );
      
      if (notesToAdd.length === 0) {
        alert('No new notes to restore from this backup');
        return;
      }
      
      // Insert all backup notes
      let successCount = 0;
      for (const note of notesToAdd) {
        const { error } = await supabase
          .from('notes')
          .insert([{
            title: note.title, // Already encrypted in backup
            content: note.content, // Already encrypted in backup
            image_url: note.image_url, // Already encrypted in backup
            user_id: user.id,
            created_at: note.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);
          
        if (!error) {
          successCount++;
        } else {
          console.error('Error restoring note:', error);
        }
      }
      
      // Show success message
      alert(`Successfully restored ${successCount} notes from backup while keeping your existing notes.`);
      
      // Refresh notes after restore
      fetchNotes();
      
    } catch (err) {
      console.error('Error restoring from backup:', err);
      alert('Failed to restore from backup: ' + err.message);
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
            // console.log("imagePath1", imagePath);
            
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
                // console.log("imagePath", imagePath);
                
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
            // console.log(`${allImagesToDelete.length} images deleted from storage`);
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

  // Add useEffect to calculate storage on component mount and when notes change
  useEffect(() => {
    if (user) {
      calculateUserStorage();
    }
  }, [user, notes]); // Add notes as a dependency

  useEffect(() => {
    if (!user) return; // Only track activity when user is logged in

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const inactivityTimeout = 8 * 60 * 60 * 1000; // 8 hours // 10 * 60 * 1000; // 10 minutes
    let inactivityTimer;

    const resetInactivityTimer = () => {
      setLastActivity(Date.now());
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        handleLogout();
        alert('You have been logged out due to inactivity.');
      }, inactivityTimeout);
    };

    // Set up event listeners
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer);
    });

    // Handle tab visibility
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const hiddenStartTime = Date.now();
        const checkHiddenInactivity = () => {
          if (document.hidden && (Date.now() - hiddenStartTime >= inactivityTimeout)) {
            handleLogout();
            alert('You have been logged out due to inactivity.');
          }
        };
        setTimeout(checkHiddenInactivity, inactivityTimeout);
      } else {
        resetInactivityTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial timer
    resetInactivityTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(inactivityTimer);
    };
  }, [user]);

  // Modify the password reset functions
  const handlePasswordReset = async (email) => {
    try {
      // First, check if the email exists in auth.users
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error("Error getting user:", userError);
      }

      // Send password reset email using Supabase Auth
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        throw error;
      }

      alert('Password reset instructions have been sent to your email.');
      setShowPasswordReset(false);
      
    } catch (err) {
      console.error("Password reset error:", err);
      alert('Error: ' + (err.message || 'Failed to send reset instructions'));
    }
  };

  // Function to handle the actual password update
  const handlePasswordUpdate = async (newPassword) => {
    try {
      // Get the session to ensure we have the user
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        throw new Error('No active session found');
      }

      // Update the password using Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      alert('Password updated successfully!');
      setShowPasswordReset(false);
      
      // Optionally logout the user to re-authenticate with new password
      await handleLogout();
      
    } catch (err) {
      console.error("Password update error:", err);
      alert('Error: ' + (err.message || 'Failed to update password'));
    }
  };

  // Update the PasswordReset component JSX
  const PasswordReset = ({ onClose }) => {
    const [resetEmail, setResetEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [resetError, setResetError] = useState('');

    const handleEmailCheck = async (email) => {
      try {
        if (!email.trim()) {
          setResetError('Please enter an email address');
          return;
        }

        // Check if email exists in users table
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('username', email)
          .single();

        if (error) {
          setResetError('Error verifying email');
          return;
        }

        if (data) {
          setIsEmailVerified(true);
          setResetError('');
        } else {
          setResetError('Email not found. Please check your email address.');
        }
      } catch (err) {
        setResetError('Error checking email');
        console.error(err);
      }
    };

    const handlePasswordUpdate = async () => {
      try {
        if (!resetEmail || !newPassword) {
          setResetError('Please fill in all fields');
          return;
        }

        if (newPassword.length < 6) {
          setResetError('Password must be at least 6 characters long');
          return;
        }

        // Hash the password before updating
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update the password in users table with hashed password
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            password: hashedPassword,
            updated_at: new Date().toISOString()
          })
          .eq('username', resetEmail);

        if (updateError) throw updateError;

        alert('Password updated successfully! Please login with your new password.');
        onClose();
        setResetEmail('');
        setNewPassword('');
        setIsEmailVerified(false);
        setResetError('');

      } catch (err) {
        setResetError('Error updating password: ' + (err.message || 'Unknown error'));
        console.error(err);
      }
    };

    return (
      <div className="password-reset-container">
        <h2>Reset Password</h2>
        {!isEmailVerified ? (
          // Step 1: Email verification
          <div className="input-group">
            <input
              type="email"
              placeholder="Enter your email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="reset-input"
            />
            <button 
              onClick={() => handleEmailCheck(resetEmail)}
              className="reset-button"
            >
              Verify Email
            </button>
          </div>
        ) : (
          // Step 2: New password input
          <div className="input-group">
            <p className="verified-email">Email verified: {resetEmail}</p>
            <input
              type="password"
              placeholder="Enter new password"
              onChange={(e) => setNewPassword(e.target.value)}
              className="reset-input"
              autoComplete="off"
            />
            <button 
              onClick={handlePasswordUpdate}
              className="reset-button"
            >
              Update Password
            </button>
          </div>
        )}
        
        {resetError && <p className="error-message">{resetError}</p>}
        
        <button 
          onClick={onClose}
          className="cancel-button"
        >
          Cancel
        </button>
      </div>
    );
  };

  // Function to cancel editing
  const cancelEditing = () => {
    setTitle('');
    setContent('');
    setImageUrl(null);
    setEditingId(null);
  };

  // Function to view backup details
  const viewBackupDetails = async (backupId) => {
    try {
      // Find the backup in the backupList
      const backup = backupList.find(b => b.id === backupId);
      
      if (!backup || !backup.backup_data || !backup.backup_data.notes) {
        alert('Backup data not found or corrupted');
        return;
      }
      
      // Process the backup notes to decrypt them for viewing
      const processedNotes = backup.backup_data.notes.map(note => {
        try {
          return {
            ...note,
            id: note.id,
            title: decryptData(note.title),
            content: decryptData(note.content),
            image_url: note.image_url ? decryptData(note.image_url) : null,
            created_at: note.created_at,
            updated_at: note.updated_at
          };
        } catch (err) {
          console.error('Error decrypting note in backup:', err);
          return {
            ...note,
            title: "Error decrypting title",
            content: "Error decrypting content",
            decryptError: true
          };
        }
      });
      
      setBackupDetails(processedNotes);
      setViewingBackup(backup);
    } catch (err) {
      console.error('Error viewing backup details:', err);
      alert('Failed to load backup details');
    }
  };

  // Function to close backup details view
  const closeBackupDetails = () => {
    setViewingBackup(null);
    setBackupDetails([]);
  };

  // Define all styles inside the component
  const backupViewerStyles = `
    .backup-details-panel {
      background-color: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 20px;
      margin-top: 20px;
    }
    
    .backup-details-header {
      border-bottom: 1px solid #eee;
      padding-bottom: 15px;
      margin-bottom: 15px;
    }
    
    .backup-details-header h2 {
      margin-top: 0;
      margin-bottom: 10px;
      color: #2c3e50;
    }
    
    .backup-details-header p {
      margin: 5px 0;
      color: #7f8c8d;
      font-size: 14px;
    }
    
    .backup-notes-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    
    .backup-note-card {
      background-color: #f9f9f9;
      border-radius: 6px;
      padding: 15px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      transition: transform 0.2s;
    }
    
    .backup-note-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    
    .backup-note-card h4 {
      margin-top: 0;
      margin-bottom: 10px;
      color: #2c3e50;
      font-size: 16px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .note-preview {
      max-height: 100px;
      overflow: hidden;
      margin-bottom: 10px;
      font-size: 14px;
      color: #555;
    }
    
    .note-image-preview {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 10px 0;
      font-size: 12px;
      color: #666;
    }
    
    .backup-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    
    .backup-actions button {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 13px;
      border: none;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .view-btn {
      background-color: #3498db;
      color: white;
    }
    
    .view-btn:hover {
      background-color: #2980b9;
    }
    
    .restore-btn {
      background-color: #2ecc71;
      color: white;
    }
    
    .restore-btn:hover {
      background-color: #27ae60;
    }
    
    .delete-btn {
      background-color: #e74c3c;
      color: white;
    }
    
    .delete-btn:hover {
      background-color: #c0392b;
    }
    
    .back-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 8px 15px;
      border: none;
      background-color: #f1f1f1;
      color: #333;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
      margin-top: 10px;
    }
    
    .back-btn:hover {
      background-color: #e0e0e0;
    }
  `;
  
  const notesControlsStyles = `
    .notes-controls {
      display: flex;
      justify-content: flex-end; /* Changed from space-between to flex-end */
      align-items: center;
      margin: 15px 0;
      padding: 10px;
      background-color: #f8f9fa;
      border-radius: 6px;
    }
    
    /* Remove sort-container styles */
    /* Remove sort-select styles */
    
    .remove-duplicates-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 15px;
      background-color: #6c5ce7;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .remove-duplicates-btn:hover {
      background-color: #5d4aeb;
    }
    
    .remove-duplicates-btn:disabled {
      background-color: #a29bea;
      cursor: not-allowed;
    }
    
    .spinner {
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  // Move the useEffect inside the component and combine all styles
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = backupViewerStyles + notesControlsStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, [backupViewerStyles, notesControlsStyles]);

  // Function to detect and remove duplicate notes
  const removeDuplicateNotes = async () => {
    try {
      setIsProcessingDuplicates(true);
      
      // Get all notes and decrypt them for comparison
      const decryptedNotes = notes.map(note => ({
        ...note,
        decryptedTitle: decryptData(note.title),
        decryptedContent: decryptData(note.content)
      }));
      
      // Group notes by content (considering identical content as duplicates)
      const contentGroups = {};
      decryptedNotes.forEach(note => {
        const key = note.decryptedContent;
        if (!contentGroups[key]) {
          contentGroups[key] = [];
        }
        contentGroups[key].push(note);
      });
      
      // Find groups with more than one note (these are duplicates)
      const duplicateGroups = Object.values(contentGroups).filter(group => group.length > 1);
      
      if (duplicateGroups.length === 0) {
        alert('No duplicate notes found.');
        setIsProcessingDuplicates(false);
        return;
      }
      
      // Count total duplicates to be removed
      const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0);
      
      // Confirm with user
      const confirmRemoval = window.confirm(
        `Found ${totalDuplicates} duplicate notes. Would you like to remove them?
        (For each group of identical notes, only the most recent one will be kept)`
      );
      
      if (!confirmRemoval) {
        setIsProcessingDuplicates(false);
        return;
      }
      
      // For each group, keep the most recently updated note and delete the rest
      let deletedCount = 0;
      for (const group of duplicateGroups) {
        // Sort by updated_at to keep the most recent one
        group.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        
        // Keep the first one (most recent), delete the rest
        const notesToDelete = group.slice(1);
        
        for (const noteToDelete of notesToDelete) {
          const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', noteToDelete.id);
          
          if (!error) {
            deletedCount++;
          } else {
            console.error('Error deleting duplicate note:', error);
          }
        }
      }
      
      // Refresh notes and notify user
      await fetchNotes();
      alert(`Successfully removed ${deletedCount} duplicate notes.`);
    } catch (err) {
      console.error('Error removing duplicates:', err);
      alert('Error removing duplicate notes. Please try again.');
    } finally {
      setIsProcessingDuplicates(false);
    }
  };

  return (
    <div className="container">
      {user ? (
        <div className="dashboard">
          {/* Mobile sidebar toggle button */}
          {isMobile && (
            <button 
              className="mobile-sidebar-toggle"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              <FaPlus style={{ transform: isSidebarVisible ? 'rotate(45deg)' : 'rotate(0deg)' }} />
            </button>
          )}
          
          {/* Sidebar overlay for mobile */}
          {isMobile && isSidebarVisible && (
            <div 
              className="sidebar-overlay"
              onClick={toggleSidebar}
            />
          )}
          
          <div className={`sidebar ${isSidebarVisible ? 'visible' : 'hidden'} ${isMobile ? 'mobile' : 'desktop'}`}>
            <h2>Welcome {user.username}</h2>
            <div className="storage-status">
              <FaHdd className="storage-icon" />
              <div className="storage-details">
                <div className="storage-text-wrapper">
                  <span className="storage-text">
                    {formatBytes(userStorage.used)}
                    {userStorage.unlimited ? (
                      <span className="unlimited-badge">Unlimited</span>
                    ) : (
                      <> / {formatBytes(userStorage.total)}</>
                    )}
                  </span>
                </div>
                <div className="storage-bar">
                  {userStorage.unlimited ? (
                    // For unlimited user, show usage without a maximum
                    <div 
                      className="storage-used unlimited"
                      style={{ 
                        width: '100%',
                        background: `linear-gradient(90deg, 
                          #4CAF50 ${Math.min((userStorage.used / (1024 * 1024 * 1024)) * 100, 100)}%, 
                          rgba(255, 255, 255, 0.1) 0%)`
                      }}
                    />
                  ) : (
                    // For regular users, show usage relative to 500MB limit
                    <div 
                      className={`storage-used ${
                        (userStorage.used / userStorage.total) > 0.9 ? 'danger' :
                        (userStorage.used / userStorage.total) > 0.7 ? 'warning' : ''
                      }`}
                      style={{ width: `${Math.min((userStorage.used / userStorage.total) * 100, 100)}%` }}
                    />
                  )}
                </div>
              </div>
            </div>
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
              <button className="backup-btn" onClick={() => {
                setShowBackupPanel(true);
                setShowHistory(false);
              }}>
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
                <Suspense fallback={<div className="loading">Loading note details...</div>}>
                  <NoteDetail 
                    note={selectedNote} 
                    onBack={handleBackToHistory}
                    decryptData={decryptData}
                  />
                </Suspense>
              ) : (
                <>
                  <div className="history-header">
                    <button className="back-to-dashboard" onClick={handleBackToDashboard}>
                      <FaArrowLeft /> Back to Dashboard
                    </button>
                    
                    {/* Add Notes Counter */}
                    <div className="notes-counter">
                      <div className="counter-icon">
                        <FaFileAlt />
                      </div>
                      <div className="counter-details">
                        <span className="counter-number">{notes.length}</span>
                        <span className="counter-label">Total Notes</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="notes-controls">
                    <button 
                      className="remove-duplicates-btn" 
                      onClick={removeDuplicateNotes}
                      disabled={isProcessingDuplicates}
                    >
                      {isProcessingDuplicates ? (
                        <><FaSpinner className="spinner" /> Processing...</>
                      ) : (
                        <><FaClone /> Remove Duplicates</>
                      )}
                    </button>
                  </div>
                  
                  <Suspense fallback={<div className="loading">Loading notes history...</div>}>
                    <NotesHistory 
                      notes={notes}
                      onViewNote={handleViewNote}
                      onEditNote={handleEdit}
                      onDeleteNote={handleDelete}
                      onDeleteMultiple={handleDeleteMultiple}
                      decryptData={decryptData}
                    />
                  </Suspense>
                </>
              )
            ) : showBackupPanel ? (
              <>
                <button className="back-to-dashboard" onClick={() => setShowBackupPanel(false)}>
                  <FaArrowLeft /> Back to Dashboard
                </button>
                
                {viewingBackup ? (
                  // Backup Details View
                  <div className="backup-details-panel">
                    <div className="backup-details-header">
                      <h2>Backup Details: {viewingBackup.backup_name}</h2>
                      <p>Date: {new Date(viewingBackup.backup_date).toLocaleString()}</p>
                      <p>Type: {viewingBackup.backup_type === 'auto' ? 'Automatic' : 'Manual'}</p>
                      <p>Contains {backupDetails.length} notes</p>
                      <button className="back-btn" onClick={closeBackupDetails}>
                        <FaArrowLeft /> Back to Backups
                      </button>
                    </div>
                    
                    <div className="backup-notes-list">
                      {backupDetails.length === 0 ? (
                        <p>No notes found in this backup</p>
                      ) : (
                        backupDetails.map(note => (
                          <div key={note.id} className="backup-note-card">
                            <h4>{note.title}</h4>
                            <div className="note-preview">
                              <div className="note-content" dangerouslySetInnerHTML={{ __html: note.content.substring(0, 150) + '...' }}></div>
                            </div>
                            {note.image_url && (
                              <div className="note-image-preview">
                                <img 
                                  src={note.image_url} 
                                  alt="Note attachment" 
                                  style={{ maxWidth: '100px', maxHeight: '100px' }}
                                />
                                <span>Has image attachment</span>
                              </div>
                            )}
                            <p>Created: {new Date(note.created_at).toLocaleString()}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  // Backup List View
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
                              <p>Notes: {backup.backup_data.note_count || backup.backup_data.notes?.length || 0}</p>
                            </div>
                            <div className="backup-actions">
                              <button onClick={() => viewBackupDetails(backup.id)} className="view-btn">
                                <FaEye /> View
                              </button>
                              <button onClick={() => restoreFromBackup(backup.id)} className="restore-btn">
                                <FaUndo /> Restore
                              </button>
                              <button onClick={() => deleteBackup(backup.id)} className="delete-btn">
                                <FaTrash /> Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <h3>{editingId ? 'Edit Note' : 'Add a New Note'}</h3>
                <div className="note-form">
                  <input
                    type="text"
                    placeholder="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="note-input"
                  />
                  <CustomQuill
                    ref={editorRef}
                    value={content}
                    onChange={setContent}
                    placeholder="Write something..."
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
                  
                  <div className="form-buttons">
                    <button onClick={saveNote} className="save-btn">
                      {editingId ? 'Update Note' : 'Save Note'}
                    </button>
                    {editingId && (
                      <button onClick={cancelEditing} className="cancel-edit-btn">
                        Cancel
                      </button>
                    )}
                  </div>
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
          <Suspense fallback={<div className="loading">Loading password reset...</div>}>
            <PasswordReset 
              onClose={() => setShowPasswordReset(false)} 
            />
          </Suspense>
        ) : (
          <div className="login-form">
            <h2>{isSignUp ? 'Sign Up' : 'Login'}</h2>
            <input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
