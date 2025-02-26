import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Button,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../supabase/supabaseClient'; // Import Supabase client

interface Note {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [image, setImage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    } else if (data) {
      setNotes(data as Note[]);
    }
  }

  // Upload an image to Supabase Storage and return its public URL
  async function uploadImage(uri: string): Promise<string | null> {
    try {
      // Compress the image
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }], // Adjust width as needed
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const response = await fetch(manipResult.uri);
      const blob = await response.blob();
      const fileExt = 'jpg'; // Use jpg extension
      const fileName = `${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('notes-images')
        .upload(fileName, blob, { cacheControl: '3600', upsert: false });

      if (error) {
        console.error('Supabase upload error:', error); // Log detailed error
        throw error;
      }

      // Get public URL
      const result = supabase.storage
        .from('notes-images')
        .getPublicUrl(data!.path);
      if (!result.data.publicUrl) {
        throw new Error('Error getting public URL');
      }
      const publicUrl = result.data.publicUrl;
      return publicUrl;
    } catch (err: any) {
      console.error('Image upload error:', err); // Log detailed error
      Alert.alert('Upload Error', err.message || 'Image upload failed');
      return null;
    }
  }

  // Pick an image using the device's image library
  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  }

  // Create or update a note
  async function saveNote() {
    let imageUrl: string | null = null;
    if (image) {
      const uploadedUrl = await uploadImage(image);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      } else {
        Alert.alert('Error', 'Failed to upload image.');
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
            image_url: imageUrl,
            created_at: timestamp,
            updated_at: timestamp,
          },
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
  async function deleteNote(id: string) {
    // Get the note to retrieve the image URL
    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .select('image_url')
      .eq('id', id)
      .single();

    if (noteError) {
      Alert.alert('Error getting note', noteError.message);
      return;
    }

    const imageUrl = noteData?.image_url;

    // Delete the note
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) {
      Alert.alert('Error deleting note', error.message);
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
          Alert.alert(
            'Note deleted, but error deleting image',
            storageError.message
          );
        } else {
          console.log('Image deleted from storage');
          Alert.alert('Note and image deleted');
        }
      }
    } else {
      Alert.alert('Note deleted');
    }

    fetchNotes();
  }

  // Start editing a note
  function startEdit(note: Note) {
    setTitle(note.title);
    setContent(note.content);
    setImage(note.image_url);
    setEditingId(note.id);
  }

  const renderItem = ({ item }: { item: Note }) => (
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
        <Button title={editingId ? 'Update Note' : 'Add Note'} onPress={saveNote} />
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