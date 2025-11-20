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
  bytesToString,
  secureClear,
} from '../crypto';
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
  const [editingId, setEditingId] = useState(null);

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
          const entryKey = decrypt(
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
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
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
                <h3 style={{ marginBottom: '15px' }}>Your Credentials</h3>
                {entries.map((entry) => (
                  <div key={entry.id} className="vault-entry">
                    <div className="vault-entry-header">
                      <div className="vault-entry-url">
                        {entry.url || 'No URL'}
                      </div>
                      <div className="vault-entry-actions">
                        <button
                          className="edit"
                          onClick={() => handleEdit(entry)}
                        >
                          Edit
                        </button>
                        <button
                          className="delete"
                          onClick={() => handleDelete(entry.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="vault-entry-info">
                      <p>
                        <strong>Username:</strong> {entry.username}
                      </p>
                      <p>
                        <strong>Password:</strong> {'•'.repeat(12)}
                      </p>
                    </div>
                  </div>
                ))}
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
