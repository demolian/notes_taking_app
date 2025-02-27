import React, { useState, useEffect } from 'react';
import './App.css'; // Import CSS
import { supabase } from './supabase/supabaseClient'; 
import imageCompression from 'browser-image-compression';
import axios from 'axios';
import PasswordModal from './PasswordModal'; // Correct import

export default function App() {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [actionType, setActionType] = useState(''); // New state to track action type
  const [noteToEdit, setNoteToEdit] = useState(null);

  useEffect(() => {
    fetchNotes();

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
      oldImageUrl = existingNote?.image_url;
    }

    if (image) {
      const uploadedUrl = await uploadImage(image);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      } else {
        alert('Error: Failed to upload image.');
        return;
      }
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

    if (editingId) {
      const { error } = await supabase
        .from('notes')
        .update({
          title,
          content,
          image_url: imageUrl,
          updated_at: timestamp.toISOString(),
          created_at: formattedDate,
        })
        .eq('id', editingId);

      if (error) alert('Error updating note: ' + error.message);
      else {
        alert('Note updated');
      }

      if (oldImageUrl && imageUrl !== oldImageUrl) {
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
      }
    } else {
      const { error } = await supabase
        .from('notes')
        .insert([
          {
            title,
            content,
            image_url: imageUrl,
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
    setEditingId(null);

    refreshNotes();
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
    setTitle(note.title);
    setContent(note.content);
    setImage(note.image_url);
    setEditingId(note.id);
  }

  const renderItem = (item) => (
    <div className="noteCard">
      <h3 className="noteTitle">{item.title}</h3>
      <p>{item.content}</p>
      {item.image_url ? (
        <img src={item.image_url} alt="Note Image" className="noteImage" />
      ) : null}
      <div className="noteActions">
        <button onClick={() => handleEdit(item)}>Edit</button>
        <p className="createdAt">Created At: {item.created_at}</p>
        <button onClick={() => handleDelete(item.id)} style={{ color: 'red' }}>
          Delete
        </button>
      </div>
    </div>
  );

  return (
    <div className="container">
      <h1 className="header">Notes</h1>
      <div className="form">
        <input
          type="text"
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="input multiline"
          placeholder="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="buttonRow">
          <button onClick={pickImage}>Pick Image</button>
          {image && image instanceof Blob && (
            <img src={URL.createObjectURL(image)} alt="Preview" className="previewImage" />
          )}
        </div>
        <button onClick={saveNote}>
          {editingId ? 'Update Note' : 'Add Note'}
        </button>
        <button onClick={analyzeNoteContent}>Analyze Content</button>
      </div>
      <div className="notesList">
        {notes.map((item) => (
          <div key={item.id}>
            {renderItem(item)}
          </div>
        ))}
      </div>
      {showModal && (
        <PasswordModal
          onConfirm={confirmAction}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
}