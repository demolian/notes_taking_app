import React, { useState } from 'react';
import { FaArrowLeft, FaTimes } from 'react-icons/fa';
import './NoteDetail.css';

const NoteDetail = ({ note, onBack, decryptData }) => {
  const [showFullImage, setShowFullImage] = useState(false);
  
  // Decrypt note data
  const title = decryptData(note.title);
  const content = decryptData(note.content);
  const imageUrl = note.image_url;

  return (
    <div className="note-detail-container">
      <div className="note-detail-header">
        <button className="back-button" onClick={onBack}>
          <FaArrowLeft /> Back
        </button>
        <h2>{title}</h2>
        <p className="created-date">Created on: {note.created_at}</p>
      </div>
      
      <div className="note-detail-content">
        <div className="note-content" dangerouslySetInnerHTML={{ __html: content }}></div>
        
        {imageUrl && (
          <div className="note-image-container">
            <img 
              src={imageUrl} 
              alt="Note attachment" 
              className="note-image"
              onClick={() => setShowFullImage(true)} 
            />
            <p className="image-hint">Click on image to view full size</p>
          </div>
        )}
      </div>
      
      {showFullImage && imageUrl && (
        <div className="full-image-overlay">
          <div className="full-image-container">
            <button 
              className="close-image-button"
              onClick={() => setShowFullImage(false)}
            >
              <FaTimes />
            </button>
            <img src={imageUrl} alt="Full size" className="full-image" />
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteDetail; 