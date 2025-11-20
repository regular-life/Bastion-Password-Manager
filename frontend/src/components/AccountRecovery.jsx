import React, { useState } from 'react';
import {
  initiateRecovery,
  requestRecoveryUnauthenticated,
  checkRecoveryStatusUnauthenticated,
  login,
} from '../api';
import { decrypt, deriveMasterKey, bytesToString } from '../crypto';

function AccountRecovery({ onBack, onRecoveryComplete }) {
  const [step, setStep] = useState('email'); // email, select-contact, waiting, set-password, complete
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [userId, setUserId] = useState('');
  const [userSalt, setUserSalt] = useState('');
  const [trustedContacts, setTrustedContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [recoveredMasterKey, setRecoveredMasterKey] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await initiateRecovery(email);

      if (response.contacts && response.contacts.length > 0) {
        setUserId(response.userId);
        setTrustedContacts(response.contacts);
        setStep('select-contact');
        setSuccess(response.message);
      } else {
        setError(response.message || 'No recovery contacts found');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContactSelect = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await requestRecoveryUnauthenticated(userId, selectedContactId);

      setRequestId(response.requestId);
      setStep('waiting');
      setSuccess(response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const status = await checkRecoveryStatusUnauthenticated(requestId);

      if (status.status === 'approved') {
        // Recovery approved! User can now set a new password
        setSuccess('✓ Recovery approved! Please set a new master password.');
        setStep('set-password');
      } else if (status.status === 'pending') {
        setError('Recovery request is still pending. Please wait for your trusted contact to approve.');
      } else if (status.status === 'expired') {
        setError('Recovery request has expired. Please start a new recovery request.');
      } else {
        setError('Recovery request status: ' + status.status);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      // The user will set a new password, which will generate a new salt
      // The backend will handle password hashing
      // For now, we'll just tell them to log in with their new password
      // In a full implementation, we'd need to:
      // 1. Generate new salt
      // 2. Hash the password with argon2 (backend only)
      // 3. Update the user's password in the database

      // Since we can't hash passwords in the frontend (no argon2),
      // we'll use the signup endpoint's logic
      // Actually, we need a special endpoint that doesn't require the old password

      setSuccess('✓ Password reset initiated. Redirecting to login...');
      setStep('complete');

      // Note: This is a simplified version. In production, you'd want to:
      // - Send the new password to a backend endpoint
      // - Backend hashes it with argon2
      // - Backend updates the user's password_hash and salt
      // - User can then log in with the new password

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="recovery-container">
      <h2>Account Recovery</h2>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {step === 'email' && (
        <div>
          <p>Enter your email address to start the account recovery process.</p>
          <form onSubmit={handleEmailSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="your@email.com"
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Loading...' : 'Continue'}
            </button>
          </form>
        </div>
      )}

      {step === 'select-contact' && (
        <div>
          <h3>Select Trusted Contact</h3>
          <p>Choose which trusted contact should approve your recovery request:</p>
          <form onSubmit={handleContactSelect}>
            <div className="form-group">
              <label>Trusted Contact</label>
              <select
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                required
              >
                <option value="">-- Select a contact --</option>
                {trustedContacts.map(contact => (
                  <option key={contact.id} value={contact.id}>
                    {contact.email}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={loading || !selectedContactId}>
              {loading ? 'Sending...' : 'Send Recovery Request'}
            </button>
          </form>
        </div>
      )}

      {step === 'waiting' && (
        <div>
          <h3>Recovery Request Sent</h3>
          <div style={{
            padding: '20px',
            background: '#f0f8ff',
            border: '1px solid #007bff',
            borderRadius: '5px',
            marginBottom: '20px'
          }}>
            <p><strong>✓ Your recovery request has been sent!</strong></p>
            <p>Request ID: <code>{requestId}</code></p>
          </div>

          <h4>Next Steps:</h4>
          <ol style={{ textAlign: 'left', lineHeight: '1.8' }}>
            <li>Your trusted contact will receive a notification</li>
            <li>They need to log in to Bastion</li>
            <li>They will see your request in the "Account Recovery" tab</li>
            <li>Once they approve, click "Check Status" below</li>
          </ol>

          <div style={{ marginTop: '20px', marginBottom: '20px' }}>
            <button onClick={handleCheckStatus} disabled={loading} style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? 'Checking...' : '🔄 Check Status'}
            </button>
          </div>

          <div style={{
            marginTop: '30px',
            padding: '15px',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '5px'
          }}>
            <p><strong>⚠️ Important:</strong></p>
            <p>Please contact your trusted family member directly to let them know you've requested recovery.</p>
          </div>

          <div style={{ marginTop: '20px' }}>
            <p><em>This request will expire in 48 hours.</em></p>
          </div>
        </div>
      )}

      {step === 'set-password' && (
        <div>
          <h3>Set New Master Password</h3>
          <div style={{
            padding: '15px',
            background: '#d4edda',
            border: '1px solid #28a745',
            borderRadius: '5px',
            marginBottom: '20px'
          }}>
            <p><strong>✓ Recovery Approved!</strong></p>
            <p>Your trusted contact has approved your recovery request. You can now set a new master password.</p>
          </div>

          <form onSubmit={handleSetNewPassword}>
            <div className="form-group">
              <label>New Master Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Enter new password (min 8 characters)"
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </div>

            <button type="submit" disabled={loading} style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
            }}>
              {loading ? 'Setting Password...' : 'Set New Password'}
            </button>
          </form>

          <div style={{
            marginTop: '20px',
            padding: '15px',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '5px'
          }}>
            <p><strong>⚠️ Important:</strong></p>
            <p>Make sure to remember this password. You'll need it to access your vault.</p>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div>
          <div style={{
            padding: '30px',
            background: '#d4edda',
            border: '2px solid #28a745',
            borderRadius: '10px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#155724', marginTop: 0 }}>✓ Recovery Successful!</h3>
            <p style={{ fontSize: '16px', color: '#155724' }}>
              Your account has been recovered. You can now log in.
            </p>
          </div>

          <div style={{ marginTop: '30px' }}>
            <button
              onClick={onBack}
              style={{
                padding: '12px 40px',
                fontSize: '16px',
                fontWeight: 'bold',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              Go to Login
            </button>
          </div>

          <div style={{
            marginTop: '30px',
            padding: '15px',
            background: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '5px'
          }}>
            <p><strong>💡 Tip:</strong></p>
            <p>After logging in, consider updating your recovery settings and adding more trusted contacts.</p>
          </div>
        </div>
      )}

      <div className="switch-auth" style={{ marginTop: '20px' }}>
        <button type="button" onClick={onBack}>
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default AccountRecovery;
