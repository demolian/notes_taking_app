import React, { useState, memo } from 'react';
import './PasswordModal.css';

const PasswordModal = memo(({ onConfirm, onCancel }) => {
  const [password, setPassword] = useState('');

  const handleConfirm = (e) => {
    e.preventDefault(); // Prevent form submission
    onConfirm(password);
    setPassword('');
  };

  return (
    <div className="modal">
      <div className="modalContent">
        <h2>Enter Admin Password</h2>
        <form onSubmit={handleConfirm}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="new-password"
          />
          <button type="submit">Confirm</button>
          <button type="button" onClick={onCancel}>Cancel</button>
        </form>
      </div>
    </div>
  );
});

PasswordModal.displayName = 'PasswordModal';

export default PasswordModal;
