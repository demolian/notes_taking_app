import React, { useState, useEffect } from 'react';
import './App.css'; // Import CSS
import { supabase } from './supabase/supabaseClient'; 
import imageCompression from 'browser-image-compression';
import axios from 'axios';
import PasswordModal from './components/PasswordModal'; // Correct import
import ImageModal from './components/ImageModal'; // Import the ImageModal
import { ReactMediaRecorder } from 'react-media-recorder';
import CryptoJS from 'crypto-js';
import NoteForm from './components/NoteForm';
import NoteList from './components/NoteList';
import ConfirmationModal from './components/ConfirmationModal';

export default function App() {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [voiceUrl, setVoiceUrl] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [actionType, setActionType] = useState(''); // New state to track action type
  const [noteToEdit, setNoteToEdit] = useState(null);
  const [fullImageUrl, setFullImageUrl] = useState(null); // State for full-screen image
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    fetchNotes();

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
  async function fetchNotes() {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      alert('Error: ' + error.message); // Use alert for web
    } else if (data) {
      setNotes(data);
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
        maxSizeMB: 1,
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
    let voiceUrl = null;

    if (image) {
      imageUrl = await uploadImage(image);
    }

    if (voiceUrl) {
      voiceUrl = await uploadVoiceNote(voiceUrl);
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

    // Encrypt the note title, content, and image URL
    const secretKey = process.env.REACT_APP_SECRET_KEY;
    const encryptedTitle = CryptoJS.AES.encrypt(title, secretKey).toString();
    const encryptedContent = CryptoJS.AES.encrypt(content, secretKey).toString();
    const encryptedImageUrl = imageUrl ? CryptoJS.AES.encrypt(imageUrl, secretKey).toString() : null;

    if (editingId) {
      const { error } = await supabase
        .from('notes')
        .update({
          title: encryptedTitle,
          content: encryptedContent,
          image_url: encryptedImageUrl,
          voice_url: voiceUrl,
          updated_at: timestamp.toISOString(),
          created_at: formattedDate,
        })
        .eq('id', editingId);

      if (error) alert('Error updating note: ' + error.message);
      else {
        alert('Note updated');
      }
    } else {
      const { error } = await supabase
        .from('notes')
        .insert([
          {
            title: encryptedTitle,
            content: encryptedContent,
            image_url: encryptedImageUrl,
            voice_url: voiceUrl,
            created_at: formattedDate,
            updated_at: timestamp.toISOString(),
          },
        ]);
      if (error) alert('Error creating note: ' + error.message);
      else {
        alert('Note created');
      }
    }

    setTitle('');
    setContent('');
    setImage(null);
    setVoiceUrl(null);
    setEditingId(null);

    refreshNotes();
  }

  const handleEdit = (note) => {
    setEditingId(note.id);
  };

  const handleDelete = (id) => {
    setNoteToDelete(id);
    setShowConfirmation(true); // Show confirmation modal
  };

  const confirmDelete = async () => {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteToDelete);
    if (error) {
      alert('Error deleting note: ' + error.message);
    } else {
      alert('Note deleted');
      fetchNotes(); // Refresh notes after deletion
    }
    setShowConfirmation(false); // Close confirmation modal
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
    const secretKey = process.env.REACT_APP_SECRET_KEY;

    // Decrypt the note fields
    const decryptedTitle = CryptoJS.AES.decrypt(note.title, secretKey).toString(CryptoJS.enc.Utf8);
    const decryptedContent = CryptoJS.AES.decrypt(note.content, secretKey).toString(CryptoJS.enc.Utf8);
    const decryptedImageUrl = note.image_url ? CryptoJS.AES.decrypt(note.image_url, secretKey).toString(CryptoJS.enc.Utf8) : null;

    // Set the decrypted values in the state
    setTitle(decryptedTitle);
    setContent(decryptedContent);
    setImage(decryptedImageUrl);
    setEditingId(note.id);
  }

  const uploadVoiceNote = async (blob) => {
    const fileName = `${Date.now()}.wav`;
    const { data, error } = await supabase.storage
      .from('notes-voices')
      .upload(fileName, blob, { cacheControl: '3600', upsert: false });

    if (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }

    const result = supabase.storage
      .from('notes-voices')
      .getPublicUrl(data.path);
    if (!result.data.publicUrl) {
      throw new Error('Error getting public URL');
    }
    return result.data.publicUrl;
  };

  return (
    <div className="container">
      <h1 className="header">Notes</h1>
      <NoteForm refreshNotes={fetchNotes} editingId={editingId} setEditingId={setEditingId} />
      <NoteList notes={notes} handleEdit={handleEdit} handleDelete={handleDelete} />
      {showModal && <PasswordModal onConfirm={confirmAction} onCancel={() => setShowModal(false)} />}
      {fullImageUrl && <ImageModal imageUrl={fullImageUrl} onClose={() => setFullImageUrl(null)} />}
      {showConfirmation && (
        <ConfirmationModal
          message="Are you sure you want to delete this note?"
          onConfirm={confirmDelete}
          onCancel={() => setShowConfirmation(false)}
        />
      )}
    </div>
  );
}