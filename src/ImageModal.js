import React, { memo } from 'react';
import './ImageModal.css';

const ImageModal = memo(({ imageUrl, onClose }) => {
  return (
    <div className="imageModal" onClick={onClose}>
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <button className="closeButton" onClick={onClose}>✕</button>
        <img src={imageUrl} alt="Full View" className="fullImage" />
      </div>
    </div>
  );
});

ImageModal.displayName = 'ImageModal';

export default ImageModal;
