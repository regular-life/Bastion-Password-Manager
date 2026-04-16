import React, { useState } from 'react';
import {
  initiateRecovery,
  requestRecoveryUnauthenticated,
  checkRecoveryStatusUnauthenticated,

  completeRecovery,
  getVaultKeysForRecovery,
  login,
} from '../api';
import {
  decrypt,
  decryptKey,
  deriveMasterKey,
  bytesToString,
  generateKeyPair,
  toBase64,
  fromBase64,
  decryptWithPrivateKey,
  generateSalt,
  encrypt,
} from '../crypto';

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
  const [sessionKeyPair, setSessionKeyPair] = useState(null);
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

        // Generate session keypair for this recovery session
        const keyPair = generateKeyPair();
        setSessionKeyPair(keyPair);

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
      const sessionPublicKeyBase64 = toBase64(sessionKeyPair.publicKey);
      const response = await requestRecoveryUnauthenticated(userId, selectedContactId, sessionPublicKeyBase64);

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
        // Recovery approved! 
        // Decrypt the master key using our session private key
        try {
          const decryptedMasterKey = decryptWithPrivateKey(
            status.encrypted_master_key_for_requester,
            sessionKeyPair.publicKey,
            sessionKeyPair.privateKey
          );

          setRecoveredMasterKey(decryptedMasterKey);
          setSuccess('✓ Recovery approved! Master key recovered. Please set a new master password.');
          setStep('set-password');
        } catch (decryptError) {
          console.error('Failed to decrypt master key:', decryptError);
          setError('Failed to decrypt recovered master key. Please try again.');
        }
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
      // 1. Generate new salt
      const newSalt = generateSalt();
      const newSaltBase64 = toBase64(newSalt);

      // 2. Derive new master key
      const newMasterKey = await deriveMasterKey(newPassword, newSaltBase64);

      // 3. Get encrypted vault keys
      const vaultResponse = await getVaultKeysForRecovery(requestId);
      const vaultKeys = vaultResponse.vaultKeys;

      // 4. Re-encrypt vault keys
      const reEncryptedVaultKeys = [];

      if (vaultKeys && vaultKeys.length > 0) {
        for (const entry of vaultKeys) {
          // Decrypt entry key with OLD master key
          const entryKey = decryptKey(
            entry.encrypted_entry_key,
            entry.encrypted_entry_key_nonce,
            recoveredMasterKey
          );

          if (!entryKey) {
            throw new Error('Failed to decrypt a vault entry. Recovery failed.');
          }

          // Encrypt entry key with NEW master key
          const encrypted = encrypt(entryKey, newMasterKey);

          reEncryptedVaultKeys.push({
            id: entry.id,
            encrypted_entry_key: encrypted.ciphertext,
            encrypted_entry_key_nonce: encrypted.nonce,
          });
        }
      }

      // 5. Complete recovery
      await completeRecovery(requestId, newPassword, newSaltBase64, reEncryptedVaultKeys);

      setSuccess('✓ Password reset successful! Redirecting to login...');
      setStep('complete');

    } catch (err) {
      console.error('Recovery completion error:', err);
      setError(err.message || 'Failed to complete recovery');
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
