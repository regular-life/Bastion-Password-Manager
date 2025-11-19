import React, { useState, useEffect } from 'react';
import {
  getMyFamily,
  shareCredential,
  getSharedCredentials,
  getVaultEntries,
  getFamilyKey,
} from '../api';
import { generateKey, encrypt, decrypt, bytesToString } from '../crypto';

function CredentialSharing({ token, masterKey }) {
  const [family, setFamily] = useState(null);
  const [familyKey, setFamilyKey] = useState(null);
  const [myCredentials, setMyCredentials] = useState([]);
  const [sharedCredentials, setSharedCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Share form
  const [selectedCredential, setSelectedCredential] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load family info
      const familyData = await getMyFamily(token);
      setFamily(familyData.family);

      // Load and decrypt family key
      const keyData = await getFamilyKey(token, familyData.family.id);
      const decryptedFamilyKey = decrypt(
        keyData.encryptedFamilyKey,
        keyData.encryptedFamilyKeyNonce,
        masterKey
      );
      setFamilyKey(decryptedFamilyKey);

      // If owner, load my credentials to share
      if (familyData.family.role === 'owner') {
        const vaultData = await getVaultEntries(token);
        const decrypted = vaultData.entries.map((entry) => {
          try {
            // Decrypt the entry key
            const entryKey = decrypt(
              entry.encrypted_entry_key,
              entry.encrypted_entry_key_nonce,
              masterKey
            );

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

            return {
              id: entry.id,
              url: decryptedUrl,
              username: data.username,
              password: data.password,
              entryKey: entryKey, // Keep for sharing
            };
          } catch (err) {
            console.error('Failed to decrypt entry:', err);
            return null;
          }
        }).filter(Boolean);

        setMyCredentials(decrypted);
      }

      // Load shared credentials
      const sharedData = await getSharedCredentials(token, familyData.family.id);

      // Decrypt shared credentials
      const decryptedShared = sharedData.credentials.map((cred) => {
        try {
          // Decrypt the content key with FAMILY KEY (not master key)
          const contentKey = decrypt(
            cred.encrypted_content_key,
            cred.encrypted_content_key_nonce,
            decryptedFamilyKey
          );

          // Decrypt credential data with content key
          const dataBytes = decrypt(
            cred.encrypted_data,
            cred.encrypted_data_nonce,
            contentKey
          );
          const data = JSON.parse(bytesToString(dataBytes));

          // Decrypt URL if present
          let decryptedUrl = '';
          if (cred.encrypted_url && cred.encrypted_url_nonce) {
            const urlBytes = decrypt(
              cred.encrypted_url,
              cred.encrypted_url_nonce,
              contentKey
            );
            decryptedUrl = bytesToString(urlBytes);
          }

          return {
            id: cred.id,
            url: decryptedUrl,
            username: data.username,
            // Members can't see plaintext password
            isMasked: familyData.family.role === 'member',
            owner_email: cred.owner_email,
          };
        } catch (err) {
          console.error('Failed to decrypt shared credential:', err);
          return null;
        }
      }).filter(Boolean);

      setSharedCredentials(decryptedShared);
      setError('');
    } catch (err) {
      if (err.status === 404) {
        setFamily(null);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // Find the credential
      console.log('Selected credential ID:', selectedCredential, typeof selectedCredential);
      console.log('My credentials count:', myCredentials.length);
      console.log('My credentials full:', myCredentials);
      console.log('ID comparison results:', myCredentials.map(c => ({
        id: c.id,
        selected: selectedCredential,
        match: c.id === selectedCredential,
        strictMatch: c.id === selectedCredential,
        trimmedMatch: c.id?.trim() === selectedCredential?.trim()
      })));

      const cred = myCredentials.find(c => c.id === selectedCredential);
      console.log('Found credential:', cred);

      if (!cred) {
        setError('Credential not found. Please make sure you have vault entries to share.');
        return;
      }

      // Encrypt the entry key (content key) with FAMILY KEY
      // This allows all family members to decrypt the credential
      const encryptedContentKey = encrypt(cred.entryKey, familyKey);

      await shareCredential(
        token,
        cred.id,
        family.id,
        encryptedContentKey.ciphertext,
        encryptedContentKey.nonce
      );

      setSuccess('Credential shared successfully!');
      setSelectedCredential('');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!family) {
    return (
      <div className="info-box">
        <p>You need to create or join a family first to share credentials.</p>
      </div>
    );
  }

  return (
    <div className="credential-sharing">
      <h2>Shared Credentials</h2>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {family.role === 'owner' && (
        <div className="section">
          <h3>Share a Credential</h3>
          {myCredentials.length === 0 ? (
            <p className="info">
              You don't have any vault entries yet. Go to "My Vault" to add credentials first.
            </p>
          ) : (
            <form onSubmit={handleShare}>
              <div className="form-group">
                <label>Select Credential to Share</label>
                <select
                  value={selectedCredential}
                  onChange={(e) => setSelectedCredential(e.target.value)}
                  required
                >
                  <option value="">-- Select --</option>
                  {myCredentials.map((cred) => (
                    <option key={cred.id} value={cred.id}>
                      {cred.url || 'No URL'} - {cred.username}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit">Share with Family</button>
            </form>
          )}
        </div>
      )}

      <div className="section">
        <h3>Shared with {family.name}</h3>
        {sharedCredentials.length > 0 ? (
          <div className="credentials-list">
            {sharedCredentials.map((cred) => (
              <div key={cred.id} className="vault-entry">
                <div className="vault-entry-header">
                  <div className="vault-entry-url">{cred.url || 'No URL'}</div>
                  {family.role === 'member' && (
                    <div className="badge">Masked Autofill Only</div>
                  )}
                </div>
                <div className="vault-entry-info">
                  <p><strong>Username:</strong> {cred.username}</p>
                  <p><strong>Password:</strong> {cred.isMasked ? '••••••••' : '(use autofill)'}</p>
                  <p className="info">Shared by: {cred.owner_email}</p>
                  {cred.isMasked && (
                    <p className="info">
                      As a family member, you can autofill this credential but cannot view the password.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="info">No credentials shared yet.</p>
        )}
      </div>
    </div>
  );
}

export default CredentialSharing;
