import React from 'react';
import CryptoJS from 'crypto-js';

const NoteItem = ({ item, handleEdit, handleDelete }) => {
  const secretKey = process.env.REACT_APP_SECRET_KEY;
  const decryptedTitle = CryptoJS.AES.decrypt(item.title, secretKey).toString(CryptoJS.enc.Utf8);
  const decryptedContent = CryptoJS.AES.decrypt(item.content, secretKey).toString(CryptoJS.enc.Utf8);
  const decryptedImageUrl = item.image_url ? CryptoJS.AES.decrypt(item.image_url, secretKey).toString(CryptoJS.enc.Utf8) : null;

  return (
    <div className="noteCard">
      <h3 className="noteTitle">{decryptedTitle}</h3>
      <p className="noteContent">
        {decryptedContent.split('\n').map((line, index) => (
          <React.Fragment key={index}>
            {line}
            <br />
          </React.Fragment>
        ))}
      </p>
      {decryptedImageUrl && (
        <img src={decryptedImageUrl} alt="Note Image" className="noteImage" />
      )}
      <div className="noteActions">
        <button onClick={() => handleEdit(item)}>Edit</button>
        <button onClick={() => handleDelete(item.id)} style={{ color: 'red' }}>
          Delete
        </button>
      </div>
    </div>
  );
};

export default NoteItem;
