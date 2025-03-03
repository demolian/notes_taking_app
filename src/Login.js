import React, { useState } from 'react';
import './Login.css'; // Optional: Add your CSS for styling

const Login = ({ onLogin, onSignUp }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false); // State to toggle between login and signup

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    // Enhanced email validation with regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    
    // For sign-up, add additional validation
    if (isSignUp) {
      // Password strength check
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      
      // Block common disposable email domains
      const disposableDomains = ['tempmail.com', 'fakeemail.com', 'mailinator.com', 'guerrillamail.com', 'sharklasers.com'];
      const emailDomain = email.split('@')[1].toLowerCase();
      if (disposableDomains.includes(emailDomain)) {
        setError('Please use a permanent email address for registration.');
        return;
      }
    }

    if (isSignUp) {
      onSignUp(email, password); // Call the sign-up function
    } else {
      onLogin(email, password); // Call the login function
    }
  };

  return (
    <div className="login-container">
      <h2>{isSignUp ? 'Sign Up' : 'Login'}</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email Address:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
          />
          <small className="form-text">Please use a valid email address that you can access.</small>
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={isSignUp ? 8 : undefined}
            placeholder={isSignUp ? "Minimum 8 characters" : "Enter your password"}
            required
          />
          {isSignUp && <small className="form-text">Password must be at least 8 characters long.</small>}
        </div>
        <button type="submit">{isSignUp ? 'Sign Up' : 'Login'}</button>
      </form>
      <p>
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
        <button onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? 'Login' : 'Sign Up'}
        </button>
      </p>
    </div>
  );
};

export default Login;
