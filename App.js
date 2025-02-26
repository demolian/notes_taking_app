import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, Button, FlatList, Image, TouchableOpacity, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (replace with your Supabase URL and Anon key)
const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT_URL.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
      Alert.alert('Error', error.message);
    } else {
      setNotes(data);
    }
  }

  // Upload an image to Supabase Storage and return its public URL
  async function uploadImage(uri) {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = uri.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('notes-images')
        .upload(fileName, blob, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      // Get public URL
      const { publicURL, error: publicURLError } = supabase.storage
        .from('notes-images')
        .getPublicUrl(data.path);
      if (publicURLError) throw publicURLError;
      return publicURL;
    } catch (err) {
      Alert.alert('Upload Error', err.message);
    }
  }

  // Pick an image using the device's image library
  async function pickImage() {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.cancelled) {
      setImage(result.uri);
    }
  }

  // Create or update a note
  async function saveNote() {
    let imageUrl = '';
    if (image) {
      imageUrl = await uploadImage(image);
    }
    if (editingId) {
      const { error } = await supabase
        .from('notes')
        .update({
          title,
          content,
          image_url: imageUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);
      if (error) Alert.alert('Error updating note', error.message);
      else {
        Alert.alert('Note updated');
      }
    } else {
      const { error } = await supabase
        .from('notes')
        .insert([
          {
            title,
            content,
            image_url: imageUrl || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        ]);
      if (error) Alert.alert('Error creating note', error.message);
      else {
        Alert.alert('Note created');
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
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);
    if (error) Alert.alert('Error deleting note', error.message);
    else {
      Alert.alert('Note deleted');
      fetchNotes();
    }
  }

  // Start editing a note
  function startEdit(note) {
    setTitle(note.title);
    setContent(note.content);
    setImage(note.image_url);
    setEditingId(note.id);
  }

  const renderItem = ({ item }) => (
    <View style={styles.noteCard}>
      <Text style={styles.noteTitle}>{item.title}</Text>
      <Text>{item.content}</Text>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.noteImage} />
      ) : null}
      <View style={styles.noteActions}>
        <TouchableOpacity onPress={() => startEdit(item)}>
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteNote(item.id)}>
          <Text style={[styles.actionText, { color: 'red' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>NotesApp</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Title"
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Content"
          value={content}
          onChangeText={setContent}
          multiline
        />
        <View style={styles.buttonRow}>
          <Button title="Pick Image" onPress={pickImage} />
          {image && (
            <Image source={{ uri: image }} style={styles.previewImage} />
          )}
        </View>
        <Button title={editingId ? "Update Note" : "Add Note"} onPress={saveNote} />
      </View>
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.notesList}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f3f4f6',
    minHeight: '100%',
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  form: {
    marginBottom: 30,
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  input: {
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  multiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewImage: {
    width: 50,
    height: 50,
    marginLeft: 10,
    borderRadius: 4,
  },
  notesList: {
    paddingBottom: 100,
  },
  noteCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  noteImage: {
    width: '100%',
    height: 150,
    marginTop: 10,
    borderRadius: 4,
  },
  noteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  actionText: {
    marginHorizontal: 10,
    fontWeight: '500',
    color: '#2563eb',
  },
});