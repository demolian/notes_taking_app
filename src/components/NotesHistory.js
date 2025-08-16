import React, { useState, memo, useMemo } from 'react';
import { FaEdit, FaTrash, FaSearch, FaSortAlphaDown, FaSortAlphaUp, FaSortNumericDown, FaSortNumericUp, FaCheckSquare, FaRegSquare, FaFilePdf, FaDownload } from 'react-icons/fa';
import { useDebounce } from '../hooks/useDebounce';
import { exportMultipleNotesToPDF } from '../utils/pdfExport';
import './NotesHistory.css';

const NotesHistory = memo(({ notes, onViewNote, onEditNote, onDeleteNote, onDeleteMultiple, decryptData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // 300ms delay
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest', 'a-z', 'z-a'
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  
  // Memoize filtered and sorted notes for better performance
  const sortedNotes = useMemo(() => {
    // Filter notes based on debounced search term
    const filteredNotes = notes.filter(note => {
      const decryptedTitle = decryptData(note.title) || '';
      const decryptedContent = decryptData(note.content) || '';
      
      // Convert to lowercase for case-insensitive search
      const searchTermLower = debouncedSearchTerm.toLowerCase();
      
      return (
        decryptedTitle.toLowerCase().includes(searchTermLower) ||
        decryptedContent.toLowerCase().includes(searchTermLower)
      );
    });
    
    // Sort notes based on sort order
    return [...filteredNotes].sort((a, b) => {
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
  }, [notes, debouncedSearchTerm, sortOrder, decryptData]);
  
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

  // Toggle multi-select mode
  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    // Clear selections when turning off multi-select mode
    if (isMultiSelectMode) {
      setSelectedNotes([]);
    }
  };
  
  // Handle checkbox selection for individual note
  const toggleNoteSelection = (e, noteId) => {
    e.stopPropagation(); // Prevent triggering the view note action
    
    setSelectedNotes(prev => {
      if (prev.includes(noteId)) {
        return prev.filter(id => id !== noteId);
      } else {
        return [...prev, noteId];
      }
    });
  };
  
  // Select or deselect all notes
  const toggleSelectAll = (e) => {
    e.stopPropagation();
    
    if (selectedNotes.length === sortedNotes.length) {
      // Deselect all if all are currently selected
      setSelectedNotes([]);
    } else {
      // Select all
      setSelectedNotes(sortedNotes.map(note => note.id));
    }
  };
  
  // Delete multiple selected notes
  const handleDeleteSelected = () => {
    if (selectedNotes.length === 0) {
      alert("No notes selected");
      return;
    }
    
    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedNotes.length} notes?`);
    if (confirmDelete) {
      onDeleteMultiple(selectedNotes);
      setSelectedNotes([]);
    }
  };

  // Export selected notes to PDF
  const handleExportSelectedToPDF = async () => {
    if (selectedNotes.length === 0) {
      alert("No notes selected for export");
      return;
    }

    setIsExportingPDF(true);
    try {
      const selectedNotesData = notes.filter(note => selectedNotes.includes(note.id));
      await exportMultipleNotesToPDF(selectedNotesData, decryptData);
      
      // Show success message
      const successMsg = document.createElement('div');
      successMsg.textContent = `${selectedNotes.length} notes exported to PDF successfully!`;
      successMsg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 1000;
        font-size: 14px;
      `;
      document.body.appendChild(successMsg);
      setTimeout(() => document.body.removeChild(successMsg), 3000);
      
      setSelectedNotes([]);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export notes to PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
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
        
        <div className="sort-actions">
          <button className="sort-button" onClick={toggleSortOrder}>
            Sort {getSortIcon()}
          </button>
          
          <button 
            className={`multi-select-button ${isMultiSelectMode ? 'active' : ''}`} 
            onClick={toggleMultiSelectMode}
          >
            {isMultiSelectMode ? "Cancel Selection" : "Select Multiple"}
          </button>
        </div>
      </div>
      
      {isMultiSelectMode && (
        <div className="multi-select-options">
          <div className="select-all-container" onClick={toggleSelectAll}>
            {selectedNotes.length === sortedNotes.length && sortedNotes.length > 0 ? 
              <FaCheckSquare className="select-all-icon" /> : 
              <FaRegSquare className="select-all-icon" />
            }
            <span>Select All ({selectedNotes.length}/{sortedNotes.length})</span>
          </div>
          
          {selectedNotes.length > 0 && (
            <div className="selected-actions">
              <button 
                className="export-selected-button" 
                onClick={handleExportSelectedToPDF}
                disabled={isExportingPDF}
              >
                {isExportingPDF ? (
                  <>
                    <FaDownload className="spinning" /> Exporting...
                  </>
                ) : (
                  <>
                    <FaFilePdf /> Export PDF ({selectedNotes.length})
                  </>
                )}
              </button>
              <button 
                className="delete-selected-button" 
                onClick={handleDeleteSelected}
              >
                <FaTrash /> Delete Selected ({selectedNotes.length})
              </button>
            </div>
          )}
        </div>
      )}
      
      {sortedNotes.length === 0 ? (
        <p className="no-notes-message">
          {searchTerm ? "No notes match your search." : "No notes available."}
        </p>
      ) : (
        <div className="notes-list">
          {sortedNotes.map((note) => (
            <div key={note.id} className={`note-item ${selectedNotes.includes(note.id) ? 'selected' : ''}`}>
              {isMultiSelectMode && (
                <div 
                  className="note-checkbox" 
                  onClick={(e) => toggleNoteSelection(e, note.id)}
                >
                  {selectedNotes.includes(note.id) ? 
                    <FaCheckSquare className="checkbox-icon" /> : 
                    <FaRegSquare className="checkbox-icon" />
                  }
                </div>
              )}
              
              <div className="note-content" onClick={() => !isMultiSelectMode && onViewNote(note)}>
                <h3>{decryptData(note.title)}</h3>
                <p className="note-date">
                  {new Date(note.created_at).toLocaleString()}
                </p>
              </div>
              
              {!isMultiSelectMode && (
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

NotesHistory.displayName = 'NotesHistory';

export default NotesHistory; 