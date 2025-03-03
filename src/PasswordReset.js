import React, { useState } from 'react';
import { supabase } from './supabase/supabaseClient'; // Import Supabase client
import bcrypt from 'bcryptjs'; // Import bcrypt for password hashing
import './PasswordReset.css'; // Import CSS for styling

const PasswordReset = ({ onBack }) => {
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userId, setUserId] = useState(null);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter your username or email.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      // Check if the user exists in the custom users table
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (error || !data) {
        setError('Username or email not found. Please check and try again.');
        return;
      }

      setUserId(data.id);

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update the password in the custom users table
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('id', userId);

      if (updateError) {
        setError('Error updating password: ' + updateError.message);
        return;
      }

      setSuccess('Password has been reset successfully!');
      
      // Clear form fields
      setNewPassword('');
      setConfirmPassword('');
      
      // After 3 seconds, go back to login
      setTimeout(() => {
        if (onBack) onBack();
      }, 3000);
    } catch (err) {
      setError('Error updating password: ' + err.message);
    }
  };

  return (
    <div className="password-reset-container">
      <h2>Reset Password</h2>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
      <form onSubmit={handleResetPassword}>
        <div className="form-group">
          <label htmlFor="username">Username or Email:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Enter your username or email"
          />
        </div>
        <div className="form-group">
          <label htmlFor="newPassword">New Password:</label>
          <input
            type="password"
            id="newPassword"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength="6"
            placeholder="Enter new password (min 6 characters)"
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password:</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Confirm new password"
          />
        </div>
        <div className="form-buttons">
          <button type="submit">Reset Password</button>
          <button type="button" onClick={onBack} className="back-button">
            Back to Login
          </button>
        </div>
      </form>
    </div>
  );
};

export default PasswordReset;
