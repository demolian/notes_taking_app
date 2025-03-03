import React, { useState } from 'react';
import { FaEdit, FaTrash, FaSearch, FaSortAlphaDown, FaSortAlphaUp, FaSortNumericDown, FaSortNumericUp } from 'react-icons/fa';
import './NotesHistory.css';

const NotesHistory = ({ notes, onViewNote, onEditNote, onDeleteNote, decryptData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest', 'a-z', 'z-a'
  
  // Filter notes based on search term
  const filteredNotes = notes.filter(note => {
    const decryptedTitle = decryptData(note.title) || '';
    const decryptedContent = decryptData(note.content) || '';
    
    // Convert to lowercase for case-insensitive search
    const searchTermLower = searchTerm.toLowerCase();
    
    return (
      decryptedTitle.toLowerCase().includes(searchTermLower) ||
      decryptedContent.toLowerCase().includes(searchTermLower)
    );
  });
  
  // Sort notes based on sort order
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    switch (sortOrder) {
      case 'newest':
        return new Date(b.created_at) - new Date(a.created_at);
      case 'oldest':
        return new Date(a.created_at) - new Date(b.created_at);
      case 'a-z':
        return decryptData(a.title).localeCompare(decryptData(b.title));
      case 'z-a':
        return decryptData(b.title).localeCompare(decryptData(a.title));
      default:
        return 0;
    }
  });
  
  // Toggle sort order
  const toggleSortOrder = () => {
    const orders = ['newest', 'oldest', 'a-z', 'z-a'];
    const currentIndex = orders.indexOf(sortOrder);
    const nextIndex = (currentIndex + 1) % orders.length;
    setSortOrder(orders[nextIndex]);
  };
  
  // Get sort icon based on current sort order
  const getSortIcon = () => {
    switch (sortOrder) {
      case 'newest':
        return <FaSortNumericDown />;
      case 'oldest':
        return <FaSortNumericUp />;
      case 'a-z':
        return <FaSortAlphaDown />;
      case 'z-a':
        return <FaSortAlphaUp />;
      default:
        return <FaSortNumericDown />;
    }
  };
  
  return (
    <div className="notes-history">
      <h2>Notes History</h2>
      
      <div className="search-sort-container">
        <div className="search-container">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <button className="sort-button" onClick={toggleSortOrder}>
          Sort {getSortIcon()}
        </button>
      </div>
      
      {sortedNotes.length === 0 ? (
        <p className="no-notes-message">
          {searchTerm ? "No notes match your search." : "No notes available."}
        </p>
      ) : (
        <div className="notes-list">
          {sortedNotes.map((note) => (
            <div key={note.id} className="note-item">
              <div className="note-content" onClick={() => onViewNote(note)}>
                <h3>{decryptData(note.title)}</h3>
                <p className="note-date">
                  {new Date(note.created_at).toLocaleString()}
                </p>
              </div>
              <div className="note-actions">
                <button 
                  className="edit-button" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditNote(note);
                  }}
                >
                  <FaEdit />
                </button>
                <button 
                  className="delete-button" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNote(note.id);
                  }}
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotesHistory; 