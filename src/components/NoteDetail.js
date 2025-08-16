import React, { useState, memo } from 'react';
import { FaArrowLeft, FaTimes, FaFilePdf, FaDownload } from 'react-icons/fa';
import ContentWithCopyButtons from './ContentWithCopyButtons';
import { exportNoteToPDF } from '../utils/pdfExport';
import './NoteDetail.css';

const NoteDetail = memo(({ note, onBack, decryptData }) => {
  const [showFullImage, setShowFullImage] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  
  // Note data is already decrypted in handleViewNote, so we use it directly
  const title = note.title;
  const content = note.content;
  const imageUrl = note.image_url;

  const handlePDFExport = async () => {
    setIsExportingPDF(true);
    try {
      await exportNoteToPDF(note, decryptData);
      // Show success message
      const successMsg = document.createElement('div');
      successMsg.textContent = 'PDF exported successfully!';
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
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };
  
  // console.log('Rendering note detail with image URL:', imageUrl);

  return (
    <div className="note-detail-container">
      <div className="note-detail-header">
        <div className="header-left">
          <button className="back-button" onClick={onBack}>
            <FaArrowLeft /> Back
          </button>
        </div>
        <div className="header-center">
          <h2>{title}</h2>
          <p className="created-date">Created on: {new Date(note.created_at).toLocaleDateString()}</p>
        </div>
        <div className="header-right">
          <button 
            className="pdf-export-button"
            onClick={handlePDFExport}
            disabled={isExportingPDF}
            title="Export to PDF"
          >
            {isExportingPDF ? (
              <>
                <FaDownload className="spinning" /> Exporting...
              </>
            ) : (
              <>
                <FaFilePdf /> Export PDF
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="note-detail-content">
        <ContentWithCopyButtons htmlContent={content} className="note-content" />
        
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
});

NoteDetail.displayName = 'NoteDetail';

export default NoteDetail; 