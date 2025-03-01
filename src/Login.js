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
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
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
