import React, { useState, useEffect } from 'react';
import './App.css'; // Import CSS
import { supabase } from './supabase/supabaseClient'; 
import imageCompression from 'browser-image-compression';

export default function App() {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchNotes();
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
    // Web implementation using a file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*'; // Limit to image files

    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (file) {
        setImage(file); // Set the File object directly
      }
    };

    input.click(); // Programmatically trigger the file input
  }

  // Create or update a note
  async function saveNote() {
    let imageUrl = null;
    let oldImageUrl = null; // Store the old image URL

    // If editing, get the existing note's image URL
    if (editingId) {
      const { data: existingNote, error: existingNoteError } = await supabase
        .from('notes')
        .select('image_url')
        .eq('id', editingId)
        .single();

      if (existingNoteError) {
        alert('Error getting existing note: ' + existingNoteError.message); // Use alert for web
        return;
      }
      oldImageUrl = existingNote?.image_url;
    }

    if (image) {
      const uploadedUrl = await uploadImage(image);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      } else {
        alert('Error: Failed to upload image.'); // Use alert for web
        return;
      }
    }

    const timestamp = new Date().toISOString();
    if (editingId) {
      const { error } = await supabase
        .from('notes')
        .update({
          title,
          content,
          image_url: imageUrl,
          updated_at: timestamp,
        })
        .eq('id', editingId);

      if (error) alert('Error updating note: ' + error.message); // Use alert for web
      else {
        alert('Note updated'); // Use alert for web
      }

      // Delete the old image if it was replaced
      if (oldImageUrl && imageUrl !== oldImageUrl) {
        const oldImagePath = oldImageUrl.split('/').pop();
        if (oldImagePath) {
          const { error: storageError } = await supabase.storage
            .from('notes-images')
            .remove([oldImagePath]);

          if (storageError) {
            console.error(
              'Error deleting old image from storage',
              storageError.message
            );
            alert(
              'Note updated, but error deleting old image: ' +
                storageError.message
            ); // Use alert for web
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
            created_at: timestamp,
            updated_at: timestamp,
          },
        ]);
      if (error) alert('Error creating note: ' + error.message); // Use alert for web
      else {
        alert('Note created'); // Use alert for web
      }
    }
    // Reset form and refresh
    setTitle('');
    setContent('');
    setImage(null);
    setEditingId(null);
    fetchNotes();
  }

  // Delete a note
  async function deleteNote(id) {
    // Get the note to retrieve the image URL
    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .select('image_url')
      .eq('id', id)
      .single();

    if (noteError) {
      alert('Error getting note: ' + noteError.message); // Use alert for web
      return;
    }

    const imageUrl = noteData?.image_url;

    // Delete the note
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error deleting note: ' + error.message); // Use alert for web
      return;
    }

    // Delete the image from storage if it exists
    if (imageUrl) {
      const imagePath = imageUrl.split('/').pop(); // Extract file name from URL
      if (imagePath) {
        const { error: storageError } = await supabase.storage
          .from('notes-images')
          .remove([imagePath]);

        if (storageError) {
          console.error('Error deleting image from storage', storageError.message);
          alert(
            'Note deleted, but error deleting image: ' + storageError.message
          ); // Use alert for web
        } else {
          console.log('Image deleted from storage');
          alert('Note and image deleted'); // Use alert for web
        }
      }
    } else {
      alert('Note deleted'); // Use alert for web
    }

    fetchNotes();
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
        <button onClick={() => startEdit(item)}>Edit</button>
        <button onClick={() => deleteNote(item.id)} style={{ color: 'red' }}>
          Delete
        </button>
      </div>
    </div>
  );

  return (
    <div className="container">
      <h1 className="header">NotesApp</h1>
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
          {image && (
            <img src={image} alt="Preview" className="previewImage" />
          )}
        </div>
        <button onClick={saveNote}>
          {editingId ? 'Update Note' : 'Add Note'}
        </button>
      </div>
      <div className="notesList">
        {notes.map((item) => (
          <div key={item.id}>{renderItem(item)}</div>
        ))}
      </div>
    </div>
  );
}