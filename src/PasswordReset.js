import React, { useState } from 'react';
import { supabase } from './supabase/supabaseClient'; // Import Supabase client
import bcrypt from 'bcryptjs'; // Import bcrypt for password hashing
import './PasswordReset.css'; // Import CSS for styling

const PasswordReset = ({ onBack }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1); // 1: Enter username/email, 2: Verify code, 3: Enter new password
  const [userId, setUserId] = useState(null);
  const [isEmailUser, setIsEmailUser] = useState(false);

  const handleInitiateReset = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter your username or email.');
      return;
    }

    // Check if input is an email address
    const isEmail = username.includes('@');
    setIsEmailUser(isEmail);

    try {
      if (isEmail) {
        // For email users, use Supabase Auth password reset
        const { error } = await supabase.auth.resetPasswordForEmail(username, {
          redirectTo: window.location.origin + '/reset-password',
        });

        if (error) {
          setError('Error sending reset email: ' + error.message);
          return;
        }

        // Also check custom users table as we need both entries
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .single();

        if (!userError && userData) {
          setUserId(userData.id);
        }

        setEmail(username);
        setSuccess('Check your email for a password reset link. If you don\'t receive it, proceed to verify your username.');
        setStep(2);
      } else {
        // For username-only users, check if they exist in custom users table
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .single();

        if (error || !data) {
          setError('Username not found. Please check and try again.');
          return;
        }

        // Generate a simple verification code (in a real app, you'd send this via email/SMS)
        // For demo purposes, we'll just use a fixed code - in production, use a secure method!
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        console.log("Verification code (for demo purposes):", code);
        
        // In a real app, store this securely and send to user
        // Here we're just storing it in state for demo purposes
        setResetToken(code);
        setUserId(data.id);
        
        // Move to verification step
        setSuccess('For demonstration purposes, the verification code is logged to the console.');
        setStep(2);
      }
    } catch (err) {
      setError('Error initiating password reset: ' + err.message);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');

    // For email users, just proceed as they will have clicked the email link
    if (isEmailUser) {
      setStep(3);
      return;
    }

    // For username users, verify the code
    if (verificationCode !== resetToken) {
      setError('Invalid verification code. Please try again.');
      return;
    }

    // Code is valid, proceed to password reset
    setStep(3);
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
      // Hash the new password for custom users table
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

      // If user signed up with email, also update in Supabase Auth
      if (isEmailUser) {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (authUpdateError) {
          setError('Error updating authentication password: ' + authUpdateError.message);
          return;
        }
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
        <form onSubmit={handleInitiateReset}>
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
          <div className="form-buttons">
            <button type="submit">Request Reset</button>
            <button type="button" onClick={onBack} className="back-button">
              Back to Login
            </button>
          </div>
        </form>
      ) : step === 2 ? (
        <form onSubmit={handleVerifyCode}>
          <div className="form-group">
            <label htmlFor="verificationCode">
              {isEmailUser 
                ? "Check your email for a reset link or enter verification code:" 
                : "Enter verification code:"}
            </label>
            <input
              type="text"
              id="verificationCode"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              required
              placeholder="Enter code"
            />
            <small>
              {isEmailUser 
                ? "If you received a reset link via email, click it and follow the instructions." 
                : "Enter the 6-digit code you received (check console for demo purposes)."}
            </small>
          </div>
          <div className="form-buttons">
            <button type="submit">Verify Code</button>
            <button type="button" onClick={() => setStep(1)} className="back-button">
              Back
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
            <button type="button" onClick={() => setStep(2)} className="back-button">
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PasswordReset;
