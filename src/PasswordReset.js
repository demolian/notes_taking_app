import React, { useState, memo } from 'react';
import { supabase } from './supabase/supabaseClient';
import bcrypt from 'bcryptjs';
import './PasswordReset.css';

const PasswordReset = memo(({ onBack }) => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userId, setUserId] = useState(null);
  const [resetMethod, setResetMethod] = useState('manual'); // 'manual' or 'email'

  const handleEmailReset = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    
    // Enhanced email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    
    try {
      // Use Supabase's built-in password reset
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      });
      
      if (error) {
        setError('Error sending reset email: ' + error.message);
        return;
      }
      
      setSuccess('Password reset email sent! Please check your inbox for further instructions.');
      
      // After 5 seconds, go back to login
      setTimeout(() => {
        if (onBack) onBack();
      }, 5000);
    } catch (err) {
      setError('Error sending reset email: ' + err.message);
    }
  };

  const handleManualReset = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    
    // Enhanced email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      // Check if the user exists in the custom users table (email is stored in username column)
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('username', email)
        .single();

      if (error || !data) {
        setError('Email not found. Please check and try again.');
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
      
      <div className="reset-method-selector">
        <button 
          className={resetMethod === 'email' ? 'active' : ''} 
          onClick={() => setResetMethod('email')}
        >
          Send Reset Email
        </button>
        <button 
          className={resetMethod === 'manual' ? 'active' : ''} 
          onClick={() => setResetMethod('manual')}
        >
          Reset Manually
        </button>
      </div>
      
      {resetMethod === 'email' ? (
        <form onSubmit={handleEmailReset}>
          <div className="form-group">
            <label htmlFor="email">Email Address:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email address"
            />
            <small className="form-text">We'll send a password reset link to this email.</small>
          </div>
          <div className="form-buttons">
            <button type="submit">Send Reset Link</button>
            <button type="button" onClick={onBack} className="back-button">
              Back to Login
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleManualReset}>
          <div className="form-group">
            <label htmlFor="email">Email Address:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email address"
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
              minLength="8"
              placeholder="Enter new password (min 8 characters)"
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
      )}
    </div>
  );
});

PasswordReset.displayName = 'PasswordReset';

export default PasswordReset;
