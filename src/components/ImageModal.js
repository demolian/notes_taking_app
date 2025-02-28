import React from 'react';
import '../ImageModal.css';

export default function ImageModal({ imageUrl, onClose }) {
  return (
    <div className="imageModal" onClick={onClose}>
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <button className="closeButton" onClick={onClose}>✕</button>
        <img src={imageUrl} alt="Full View" className="fullImage" />
      </div>
    </div>
  );
}
