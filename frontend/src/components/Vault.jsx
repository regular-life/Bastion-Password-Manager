import React, { useState, useEffect } from 'react';
import {
  getVaultEntries,
  createVaultEntry,
  updateVaultEntry,
  deleteVaultEntry,
} from '../api';
import {
  generateKey,
  encrypt,
  decrypt,
  decryptKey,
  bytesToString,
  secureClear,
} from '../crypto';
import { calculatePasswordStrength } from '../utils/passwordStrength';
import FamilyManagement from './FamilyManagement';
import CredentialSharing from './CredentialSharing';
import PasswordGenerator from './PasswordGenerator';
import AuditLog from './AuditLog';
import RecoveryManagement from './RecoveryManagement';

function Vault({ user, token, masterKey, onLogout }) {
  const [currentTab, setCurrentTab] = useState('vault');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [visiblePasswords, setVisiblePasswords] = useState(new Set());

  useEffect(() => {
    console.log('Vault mounted with masterKey:', !!masterKey);
    if (masterKey) {
      loadVaultEntries();
    } else {
      console.error('No master key available!');
      setError('Master key not available. Please log in again.');
      setLoading(false);
    }
  }, []);

  const loadVaultEntries = async () => {
    try {
      setLoading(true);
      console.log('Loading vault entries...');
      console.log('Master key available:', !!masterKey);
      console.log('Master key length:', masterKey?.length);

      const response = await getVaultEntries(token);
      console.log('Got response with', response.entries.length, 'entries');

      // If no entries, just return empty
      if (response.entries.length === 0) {
        setEntries([]);
        return;
      }

      // Decrypt entries
      const decryptedEntries = response.entries.map((entry) => {
        try {
          console.log('Decrypting entry:', entry.id);

          // Decrypt the entry key
          const entryKey = decryptKey(
            entry.encrypted_entry_key,
            entry.encrypted_entry_key_nonce,
            masterKey
          );
          console.log('Entry key decrypted, length:', entryKey.length);

          // Decrypt the entry data
          const dataBytes = decrypt(
            entry.encrypted_data,
            entry.encrypted_data_nonce,
            entryKey
          );
          const data = JSON.parse(bytesToString(dataBytes));

          // Decrypt URL if present
          let decryptedUrl = '';
          if (entry.encrypted_url && entry.encrypted_url_nonce) {
            const urlBytes = decrypt(
              entry.encrypted_url,
              entry.encrypted_url_nonce,
              entryKey
            );
            decryptedUrl = bytesToString(urlBytes);
          }

          // Clear entry key from memory
          secureClear(entryKey);

          return {
            id: entry.id,
            url: decryptedUrl,
            username: data.username,
            password: data.password,
            created_at: entry.created_at,
          };
        } catch (err) {
          console.error('Failed to decrypt entry:', err);
          return null;
        }
      }).filter(Boolean);

      setEntries(decryptedEntries);
    } catch (err) {
      console.error('Load vault entries error:', err);
      setError(err.message || 'Failed to load vault entries');
      setEntries([]); // Set empty entries on error
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Username and password are required');
      return;
    }

    try {
      // Generate random entry key
      const entryKey = generateKey();

      // Encrypt the entry key with master key
      const encryptedEntryKey = encrypt(entryKey, masterKey);

      // Encrypt the entry data with entry key
      const data = JSON.stringify({ username, password });
      const encryptedData = encrypt(data, entryKey);

      // Encrypt URL if provided
      let encryptedUrl = null;
      if (url) {
        encryptedUrl = encrypt(url, entryKey);
      }

      const entry = {
        encrypted_entry_key: encryptedEntryKey.ciphertext,
        encrypted_entry_key_nonce: encryptedEntryKey.nonce,
        encrypted_data: encryptedData.ciphertext,
        encrypted_data_nonce: encryptedData.nonce,
        encrypted_url: encryptedUrl?.ciphertext || null,
        encrypted_url_nonce: encryptedUrl?.nonce || null,
      };

      if (editingId) {
        await updateVaultEntry(token, editingId, entry);
      } else {
        await createVaultEntry(token, entry);
      }

      // Clear entry key from memory
      secureClear(entryKey);

      // Clear form
      setUrl('');
      setUsername('');
      setPassword('');
      setEditingId(null);

      // Reload entries
      await loadVaultEntries();
    } catch (err) {
      setError(err.message || 'Failed to save entry');
    }
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setUrl(entry.url);
    setUsername(entry.username);
    setPassword(entry.password);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      await deleteVaultEntry(token, id);
      await loadVaultEntries();
    } catch (err) {
      setError(err.message || 'Failed to delete entry');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setUrl('');
    setUsername('');
    setPassword('');
    setPasswordStrength(null);
  };

  const togglePasswordVisibility = (entryId) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 'vault':
        return (
          <div className="vault-container">
            <div className="add-entry-form">
              <h3>{editingId ? 'Edit Entry' : 'Add New Entry'}</h3>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Website URL (optional)</label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Username/Email</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordStrength(calculatePasswordStrength(e.target.value));
                      }}
                      required
                    />
                    {passwordStrength && password && (
                      <div className="password-strength-indicator" style={{ marginTop: '0.5rem' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.25rem'
                        }}>
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Strength:
                          </span>
                          <span style={{
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: passwordStrength.color
                          }}>
                            {passwordStrength.label} ({passwordStrength.score}/100)
                          </span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '4px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '2px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${passwordStrength.score}%`,
                            height: '100%',
                            background: passwordStrength.color,
                            transition: 'width 0.3s ease, background 0.3s ease'
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {error && <div className="error">{error}</div>}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit">
                    {editingId ? 'Update Entry' : 'Add Entry'}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      style={{ background: '#666' }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {loading ? (
              <div className="loading">Loading vault...</div>
            ) : entries.length === 0 ? (
              <div className="empty-state">
                <p>No entries yet. Add your first credential above.</p>
              </div>
            ) : (
              <div>
                <h2 style={{ marginBottom: '2rem' }}>Your Credentials</h2>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {entries.map((entry) => (
                    <div key={entry.id} className="vault-entry">
                      <div className="vault-entry-header">
                        <div style={{ flex: 1 }}>
                          <div className="vault-entry-url">
                            {entry.url || 'No URL'}
                          </div>
                          <div style={{
                            fontSize: '0.8125rem',
                            color: 'var(--text-tertiary)',
                            marginTop: '0.25rem'
                          }}>
                            Added {new Date(entry.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="vault-entry-actions">
                          <button
                            className="edit"
                            onClick={() => handleEdit(entry)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Edit
                          </button>
                          <button
                            className="delete"
                            onClick={() => handleDelete(entry.id)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="vault-entry-info">
                        <div className="credential-row">
                          <div className="credential-label">Username</div>
                          <div className="credential-value">{entry.username}</div>
                        </div>
                        <div className="credential-row">
                          <div className="credential-label">Password</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div className="credential-value" style={{ fontFamily: 'monospace' }}>
                                {visiblePasswords.has(entry.id) ? entry.password : '•'.repeat(12)}
                              </div>
                              <button
                                className="icon-button"
                                onClick={() => togglePasswordVisibility(entry.id)}
                                title={visiblePasswords.has(entry.id) ? 'Hide password' : 'Show password'}
                              >
                                {visiblePasswords.has(entry.id) ? (
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                  </svg>
                                ) : (
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                  </svg>
                                )}
                              </button>
                              <button
                                className="icon-button"
                                onClick={() => {
                                  navigator.clipboard.writeText(entry.password);
                                }}
                                title="Copy password"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                              </button>
                            </div>
                            {(() => {
                              const strength = calculatePasswordStrength(entry.password);
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{
                                    flex: 1,
                                    height: '3px',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    borderRadius: '2px',
                                    overflow: 'hidden'
                                  }}>
                                    <div style={{
                                      width: `${strength.score}%`,
                                      height: '100%',
                                      background: strength.color
                                    }} />
                                  </div>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    color: strength.color,
                                    fontWeight: '600',
                                    minWidth: '60px',
                                    textAlign: 'right'
                                  }}>
                                    {strength.label}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case 'family':
        return <FamilyManagement token={token} masterKey={masterKey} />;
      case 'sharing':
        return <CredentialSharing token={token} masterKey={masterKey} />;
      case 'generator':
        return <PasswordGenerator />;
      case 'audit':
        return <AuditLog token={token} />;
      case 'recovery':
        return <RecoveryManagement token={token} masterKey={masterKey} user={user} />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="header">
        <h1>Bastion</h1>
        <div>
          <span style={{ marginRight: '20px', color: '#666' }}>{user.email}</span>
          <button onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="tabs">
        <button
          className={currentTab === 'vault' ? 'tab active' : 'tab'}
          onClick={() => setCurrentTab('vault')}
        >
          My Vault
        </button>
        <button
          className={currentTab === 'family' ? 'tab active' : 'tab'}
          onClick={() => setCurrentTab('family')}
        >
          Family Sharing
        </button>
        <button
          className={currentTab === 'sharing' ? 'tab active' : 'tab'}
          onClick={() => setCurrentTab('sharing')}
        >
          Shared Credentials
        </button>
        <button
          className={currentTab === 'generator' ? 'tab active' : 'tab'}
          onClick={() => setCurrentTab('generator')}
        >
          Password Generator
        </button>
        <button
          className={currentTab === 'audit' ? 'tab active' : 'tab'}
          onClick={() => setCurrentTab('audit')}
        >
          Audit Log
        </button>
        <button
          className={currentTab === 'recovery' ? 'tab active' : 'tab'}
          onClick={() => setCurrentTab('recovery')}
        >
          Account Recovery
        </button>
      </div>

      {renderTabContent()}
    </>
  );
}

export default Vault;
