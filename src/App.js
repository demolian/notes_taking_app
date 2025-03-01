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

const secretKey = process.env.REACT_APP_SECRET_KEY; // Get the secret key from environment variables

// Function to encrypt data
function encryptData(data) {
  return CryptoJS.AES.encrypt(data, secretKey).toString();
}

// Function to decrypt data
function decryptData(ciphertext) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false); // State to toggle between login and sign-up

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error fetching session:', error);
      } else {
        setUser(session?.user || null);
        if (session?.user) {
          fetchNotes(); // Fetch notes if a session exists
          console.log("User session found:", session.user.email);
        }
      }
    };

    checkSession(); // Call the function to check the session

    // Set up real-time subscription
    const notesSubscription = supabase
      .channel('public:notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, payload => {
        console.log('Change received!', payload);
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
  async function fetchNotes() {
    if (!user) return; // Only fetch notes if a user is logged in
    console.log('Fetching notes for user ID:', user.id); // Log the user ID being used to fetch notes
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id) // Filter notes by user ID
      .order('created_at', { ascending: false }); // Order by creation date

    if (error) {
      alert('Error fetching notes: ' + error.message); // Use alert for web
    } else if (data) {
      console.log('Fetched notes:', data); // Log the fetched notes
      setNotes(data); // Set the notes state
    }
  }

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
      console.log('Analysis Result:', analysis);
    }
  }

  // Upload an image to Supabase Storage and return its public URL
  async function uploadImage(file) {
    try {
      // Ensure the file is a valid Blob or File
      if (!(file instanceof Blob || file instanceof File)) {
        throw new Error('The file given is not an instance of Blob or File');
      }

      // Compress the image
      const options = {
        maxSizeMB: 10, // File size limit
        maxWidthOrHeight: 800,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);

      const fileName = `${Date.now()}.jpg`;

      const { data, error } = await supabase.storage
        .from('notes-images')
        .upload(fileName, compressedFile, { cacheControl: '3600', upsert: false });

      if (error) {
        console.error('Supabase upload error:', error);
        throw error;
      }

      // Get public URL
      const result = supabase.storage
        .from('notes-images')
        .getPublicUrl(data.path);
      if (!result.data.publicUrl) {
        throw new Error('Error getting public URL');
      }
      const publicUrl = result.data.publicUrl;
      return publicUrl;
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
    let imageUrl = null;
    let oldImageUrl = null;

    if (editingId) {
      const { data: existingNote, error: existingNoteError } = await supabase
        .from('notes')
        .select('image_url')
        .eq('id', editingId)
        .single();

      if (existingNoteError) {
        alert('Error getting existing note: ' + existingNoteError.message);
        return;
      }
      oldImageUrl = existingNote?.image_url; // Store the old image URL
    }

    // Only upload a new image if one is provided
    if (image) {
      // Check if the image is a valid Blob or File
      if (image instanceof Blob || image instanceof File) {
        const uploadedUrl = await uploadImage(image);
        if (uploadedUrl) {
          imageUrl = uploadedUrl; // Use the new image URL if uploaded
        } else {
          alert('Error: Failed to upload image.');
          return;
        }
      } else {
        alert('Error: The file given is not an instance of Blob or File.');
        return;
      }
    } else {
      imageUrl = oldImageUrl; // Keep the old image URL if no new image is provided
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

    // Encrypt title, content, and image URL before saving
    const encryptedTitle = encryptData(title); // Encrypt title
    const encryptedContent = encryptData(content); // Encrypt content
    const encryptedImageUrl = encryptData(imageUrl); // Encrypt image URL

    if (editingId) {
      const { error } = await supabase
        .from('notes')
        .update({
          title: encryptedTitle,
          content: encryptedContent,
          image_url: imageUrl ? encryptedImageUrl : null,
          updated_at: timestamp.toISOString(),
          user_id: user.id,
        })
        .eq('id', editingId);

      if (error) {
        alert('Error updating note: ' + error.message);
        return;
      }

      // Handle old image deletion if a new image is uploaded
      if (image && oldImageUrl && imageUrl !== oldImageUrl) {
        const oldImagePath = oldImageUrl.split('/').pop();
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
      } else if (image === null && oldImageUrl) {
        // If the image is deleted, remove it from storage
        const oldImagePath = oldImageUrl.split('/').pop();
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
          image_url: imageUrl ? encryptedImageUrl : null,
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

    fetchNotes(); // Refresh notes
  }

  const handleDelete = (id) => {
    setNoteToDelete(id);
    setActionType('delete');
    setShowModal(true);
  };

  const handleEdit = (note) => {
    setNoteToEdit(note);
    setActionType('edit');
    setShowModal(true);
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
    return (
      <div className="noteCard" key={item.id}>
        <h3 className="noteTitle">{decryptData(item.title)}</h3>
        <p className="noteContent">{decryptData(item.content)}</p>
        <p className="createdAt">Created At: {item.created_at}</p>
        <div className="noteActions">
          <button onClick={() => handleEdit(item)}>Edit</button>
          <button onClick={() => handleDelete(item.id)} style={{ color: 'red' }}>
            Delete
          </button>
        </div>
      </div>
    );
  };

  // Function to handle user login
  const handleLogin = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      setError('Login error: User not found. Please sign up.');
      return;
    }

    const isMatch = await bcrypt.compare(password, data.password);
    if (isMatch) {
      setUser(data); // Set the logged-in user
      await fetchNotes(); // Fetch notes for the logged-in user
      alert('Login successful!'); // Show success message
    } else {
      setError('Login error: Incorrect password.');
    }
  };

  // Function to handle user sign-up
  const handleSignUp = async () => {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert([{ email, password: hashedPassword }]);

    if (error) {
      setError('Sign-up error: ' + error.message);
      return; // Exit if there's an error
    }

    // Check if data is returned and set the user
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
            <h2>Welcome {user.email}</h2>
            <button onClick={handleHistory}>History</button>
            <button>Notes 1</button>
            <button>Notes 2</button>
            <button>Notes 3</button>
            <button onClick={handleLogout}>Logout</button>
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
          </div>
          <div className="notes-list">
            {notes.map((item) => (
              <div key={item.id}>
                {renderItem(item)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="login-form">
          <h2>{isSignUp ? 'Sign Up' : 'Login'}</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
        </div>
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
