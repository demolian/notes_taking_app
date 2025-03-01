import React, { useState, useEffect } from 'react';
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
  const [analyzeContent, setAnalyzeContent] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false); // New state for password reset view

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
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);

    // Clean up subscription on unmount
    return () => {
      supabase.removeChannel(notesSubscription);
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

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

      const fileName = `${Date.now()}_${file.name}`; // Create a unique file name

      const { data, error } = await supabase.storage
        .from('notes-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

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
        const uploadedUrl = await uploadImage(file); // Upload the image and get the URL
        setImageUrl(uploadedUrl); // Set the image URL in state
      }
    };

    input.click();
  }

  // Function to refresh notes
  function refreshNotes() {
    fetchNotes();
  }

  // Create or update a note
  async function saveNote() {
    let imageUrlToSave = null;

    if (imageUrl) {
      imageUrlToSave = imageUrl; // Use the image URL from state
    }

    const timestamp = new Date();
    const formattedDate = timestamp.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const noteData = {
      title: title,
      content: content,
      image_url: imageUrlToSave,
      created_at: formattedDate,
      updated_at: formattedDate,
      user_id: user.id,
    };

    const encryptedTitle = encryptData(noteData.title); // Encrypt title
    const encryptedContent = encryptData(noteData.content); // Encrypt content
    const encryptedImageUrl = encryptData(imageUrlToSave); // Encrypt image URL

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

      // Handle old image deletion if a new image is uploaded
      if (image && imageUrl && imageUrl !== imageUrlToSave) {
        const oldImagePath = imageUrl.split('/').pop();
        if (oldImagePath) {
          const { error: storageError } = await supabase.storage
            .from('notes-images')
            .remove([oldImagePath]);

          if (storageError) {
            console.error('Error deleting old image from storage', storageError.message);
            alert('Note updated, but error deleting old image: ' + storageError.message);
          } else {
            console.log('Old image deleted from storage');
          }
        }
      } else if (image === null && imageUrl) {
        // If the image is deleted, remove it from storage
        const oldImagePath = imageUrl.split('/').pop();
        if (oldImagePath) {
          const { error: storageError } = await supabase.storage
            .from('notes-images')
            .remove([oldImagePath]);

          if (storageError) {
            console.error('Error deleting old image from storage', storageError.message);
            alert('Error deleting old image: ' + storageError.message);
          } else {
            console.log('Old image deleted from storage');
          }
        }
        // Update the image_url in the notes table to null
        await supabase
          .from('notes')
          .update({ image_url: null })
          .eq('id', editingId);
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

    setTitle(''); // Reset title
    setContent(''); // Reset content
    setImage(null); // Reset image
    setEditingId(null); // Reset editing ID
    setImageUrl(null); // Reset image URL

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
        // alert('Note deleted successfully!');
      }
    }
  };

  const handleEdit = (note) => {
    const confirmEdit = window.confirm("Are you sure you want to edit this note?");
    if (confirmEdit) {
      setTitle(decryptData(note.title)); // Set the title for editing
      setContent(decryptData(note.content)); // Set the content for editing
      setEditingId(note.id); // Set the ID of the note being edited
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
    if (imageUrl) {
      const imagePath = imageUrl.split('/').pop();
      if (imagePath) {
        const { error: storageError } = await supabase.storage
          .from('notes-images')
          .remove([imagePath]);

        if (storageError) {
          console.error('Error deleting image from storage', storageError.message);
          alert('Note deleted, but error deleting image: ' + storageError.message);
        } else {
          console.log('Image deleted from storage');
          alert('Note and image deleted');
        }
      }
    } else {
      alert('Note deleted');
    }

    // Refresh notes without reloading
    refreshNotes();
  }

  // Start editing a note
  function startEdit(note) {
    const decryptedTitle = decryptData(note.title); // Decrypt title
    const decryptedContent = decryptData(note.content); // Decrypt content
    const decryptedImageUrl = note.image_url ? decryptData(note.image_url) : null; // Decrypt image URL

    setTitle(decryptedTitle); // Set decrypted title
    setContent(decryptedContent); // Set decrypted content
    setImage(decryptedImageUrl); // Set decrypted image URL
    setEditingId(note.id); // Set editing ID
  }

  // Render a note item
  const renderItem = (item) => {
    const title = decryptData(item.title);
    const content = decryptData(item.content);
    const imageUrl = item.image_url; // Assuming the image URL is stored in this field

    if (!title || !content) {
      return null; // Skip rendering if decryption fails
    }

    return (
      <div className="noteCard" key={item.id}>
        <h4>{title}</h4>
        <p>{content}</p>
        {imageUrl && <img src={imageUrl} alt="Note related" style={{ maxWidth: '100%', height: 'auto' }} />} {/* Render the image */}
        <p>Created At: {item.created_at}</p>
        <button onClick={() => handleEdit(item)}>Edit</button>
        <button onClick={() => handleDelete(item.id)} style={{ color: 'red' }}>
          Delete
        </button>
      </div>
    );
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
      //alert('Login successful!'); // Show success message
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
    await supabase.auth.signOut();
    setUser(null); // Clear user state
    setNotes([]); // Clear notes
  };

  // Function to fetch all previous notes when History button is clicked
  const handleHistory = async () => {
    await fetchNotes(); // Fetch all notes for the logged-in user
  };

  return (
    <div className="container">
      {user ? (
        <div className="dashboard">
          <div className="sidebar">
            <h2>Welcome {user.username}</h2>
            <button className="history-button" onClick={handleHistory}>History</button>
            <button>Notes 1</button>
            <button>Notes 2</button>
            <button>Notes 3</button>
            <button className="logout-button" onClick={handleLogout}>Logout</button>
          </div>
          <div className="main-content">
            <h3>Add a New Note</h3>
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="Content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="buttonRow">
              <button onClick={pickImage}>Pick Image</button>
              {image && image instanceof Blob && (
                <img src={URL.createObjectURL(image)} alt="Preview" className="previewImage" />
              )}
              {editingId && image && (
                <button onClick={() => setImage(null)} style={{ color: 'red' }}>
                  Delete Image
                </button>
              )}
            </div>
            <button onClick={saveNote}>
              {editingId ? 'Update Note' : 'Add Note'}
            </button>
            <button onClick={analyzeNoteContent}>Analyze Content</button>
            <div>
              <div className="notesGrid">
                {notes.map(renderItem)}
              </div>
            </div>
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
