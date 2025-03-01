import React from 'react';
import NoteItem from './NoteItem';

const NoteList = ({ notes, handleEdit, handleDelete }) => {
  return (
    <div className="notesList">
      {notes.map((item) => (
        <NoteItem key={item.id} item={item} handleEdit={handleEdit} handleDelete={handleDelete} />
      ))}
    </div>
  );
};

export default NoteList;
