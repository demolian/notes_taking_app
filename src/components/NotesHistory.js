import React from 'react';
import { FaCalendarAlt, FaEye } from 'react-icons/fa';
import './NotesHistory.css';

const NotesHistory = ({ notes, onViewNote, decryptData }) => {
  return (
    <div className="notes-history-container">
      <h2 className="history-title">Notes History</h2>
      
      {notes.length === 0 ? (
        <p className="no-notes-message">No notes found.</p>
      ) : (
        <div className="history-list">
          {notes.map((note) => {
            const title = decryptData(note.title);
            
            if (!title) {
              return null; // Skip notes that can't be decrypted
            }
            
            return (
              <div 
                key={note.id} 
                className="history-item"
                onClick={() => onViewNote(note)}
              >
                <h3 className="history-item-title">{title}</h3>
                <div className="history-item-meta">
                  <span className="history-item-date">
                    <FaCalendarAlt /> {note.created_at}
                  </span>
                  <button className="view-note-btn">
                    <FaEye /> View
                  </button>
                </div>
                {note.image_url && <div className="has-image-indicator">Has Image</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotesHistory; 