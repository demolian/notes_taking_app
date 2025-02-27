import React from 'react';
import './ImageModal.css';

export default function ImageModal({ imageUrl, onClose }) {
  return (
    <div className="imageModal" onClick={onClose}>
      <img src={imageUrl} alt="Full View" className="fullImage" />
    </div>
  );
}
