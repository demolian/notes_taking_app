import React, { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import { supabase } from '../supabase/supabaseClient';
import ImageUpload from './ImageUpload';
import VoiceNote from './VoiceNote';

const NoteForm = ({ refreshNotes, editingId, setEditingId }) => {
  const [title, setLocalTitle] = useState('');
  const [content, setLocalContent] = useState('');
  const [image, setLocalImage] = useState(null);
  const [voiceBlob, setVoiceBlob] = useState(null);

  useEffect(() => {
    if (editingId) {
      // Fetch the note to edit and set the local state
      const fetchNoteToEdit = async () => {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('id', editingId)
          .single();

        if (data) {
          const secretKey = process.env.REACT_APP_SECRET_KEY;
          setLocalTitle(CryptoJS.AES.decrypt(data.title, secretKey).toString(CryptoJS.enc.Utf8));
          setLocalContent(CryptoJS.AES.decrypt(data.content, secretKey).toString(CryptoJS.enc.Utf8));
          // Optionally set the image if needed
        }
      };

      fetchNoteToEdit();
    }
  }, [editingId]);

  const saveNote = async () => {
    const secretKey = process.env.REACT_APP_SECRET_KEY;
    const encryptedTitle = CryptoJS.AES.encrypt(title, secretKey).toString();
    const encryptedContent = CryptoJS.AES.encrypt(content, secretKey).toString();
    const encryptedImageUrl = image ? CryptoJS.AES.encrypt(URL.createObjectURL(image), secretKey).toString() : null;

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
      // Update the existing note
      const { error } = await supabase
        .from('notes')
        .update({
          title: encryptedTitle,
          content: encryptedContent,
          image_url: encryptedImageUrl,
          updated_at: timestamp.toISOString(),
        })
        .eq('id', editingId);

      if (error) alert('Error updating note: ' + error.message);
      else {
        alert('Note updated');
        refreshNotes();
        setEditingId(null); // Reset editing ID after updating
      }
    } else {
      // Create a new note
      const { error } = await supabase
        .from('notes')
        .insert([
          {
            title: encryptedTitle,
            content: encryptedContent,
            image_url: encryptedImageUrl,
            voice_url: voiceBlob ? await uploadVoiceNote(voiceBlob) : null, // Upload voice note if exists
            created_at: formattedDate,
            updated_at: timestamp.toISOString(),
          },
        ]);

      if (error) alert('Error creating note: ' + error.message);
      else {
        alert('Note created');
        refreshNotes();
        setLocalTitle('');
        setLocalContent('');
        setLocalImage(null);
        setVoiceBlob(null); // Reset voice blob after saving
      }
    }
  };

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
    <div className="form">
      <input
        type="text"
        className="input"
        placeholder="Title"
        value={title}
        onChange={(e) => setLocalTitle(e.target.value)}
      />
      <textarea
        className="input multiline"
        placeholder="Content"
        value={content}
        onChange={(e) => setLocalContent(e.target.value)}
      />
      <ImageUpload setImage={setLocalImage} />
      <VoiceNote setVoiceBlob={setVoiceBlob} />
      <button onClick={saveNote}>
        {editingId ? 'Update Note' : 'Add Note'}
      </button>
    </div>
  );
};

export default NoteForm;
