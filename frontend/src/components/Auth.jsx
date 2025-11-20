import React, { useState } from 'react';
import { signup, login } from '../api';
import { deriveMasterKey } from '../crypto';
import AccountRecovery from './AccountRecovery';

function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [showRecovery, setShowRecovery] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      console.log('Starting authentication...');
      const response = isLogin
        ? await login(email, password)
        : await signup(email, password);

      console.log('Auth response:', response);
      console.log('Salt received:', response.salt);

      // Derive master key from password and salt
      console.log('Deriving master key...');
      const masterKey = await deriveMasterKey(password, response.salt);
      console.log('Master key derived, length:', masterKey.length);

      console.log('Calling onLogin...');
      onLogin(response.user, response.token, masterKey);
      console.log('onLogin completed');
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  if (showRecovery) {
    return (
      <AccountRecovery
        onBack={() => setShowRecovery(false)}
        onRecoveryComplete={(user, token, masterKey) => {
          setShowRecovery(false);
          onLogin(user, token, masterKey);
        }}
      />
    );
  }

  return (
    <div className="auth-container">
      <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label>Master Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={isLogin ? 'current-password' : 'new-password'}
          />
        </div>

        {!isLogin && (
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
        </button>
      </form>

      {isLogin && (
        <div style={{ marginTop: '10px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => setShowRecovery(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#007bff',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Forgot your password?
          </button>
        </div>
      )}

      <div className="switch-auth">
        {isLogin ? "Don't have an account?" : 'Already have an account?'}
        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setError('');
          }}
        >
          {isLogin ? 'Sign Up' : 'Login'}
        </button>
      </div>
    </div>
  );
}

export default Auth;
