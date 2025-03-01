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
  const [step, setStep] = useState(1); // 1: Enter username, 2: Enter new password

  const handleCheckUsername = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter your username.');
      return;
    }

    // Check if username exists
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (error || !data) {
      setError('Username not found. Please check and try again.');
      return;
    }

    // Username exists, move to password reset step
    setStep(2);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update the user's password in the database
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('username', username);

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
      
      {step === 1 ? (
        <form onSubmit={handleCheckUsername}>
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-buttons">
            <button type="submit">Continue</button>
            <button type="button" onClick={onBack} className="back-button">
              Back to Login
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleResetPassword}>
          <div className="form-group">
            <label htmlFor="newPassword">New Password:</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
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
            />
          </div>
          <div className="form-buttons">
            <button type="submit">Reset Password</button>
            <button type="button" onClick={() => setStep(1)} className="back-button">
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PasswordReset;
