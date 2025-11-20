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
  const [families, setFamilies] = useState([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [selectedFamily, setSelectedFamily] = useState(null);
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

      // Load families
      const familyData = await getMyFamily(token);
      const loadedFamilies = familyData.families || [];
      setFamilies(loadedFamilies);

      // If we have families but no selection, select the first one
      if (loadedFamilies.length > 0 && !selectedFamilyId) {
        setSelectedFamilyId(loadedFamilies[0].id);
      }

      setError('');
    } catch (err) {
      if (err.status === 404) {
        setFamilies([]);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Load family-specific data when selection changes
  useEffect(() => {
    if (selectedFamilyId && families.length > 0) {
      loadFamilyData(selectedFamilyId);
    }
  }, [selectedFamilyId, families]);

  const loadFamilyData = async (familyId) => {
    try {
      setLoading(true);
      const currentFamily = families.find(f => f.id === familyId);
      setSelectedFamily(currentFamily);

      // Load and decrypt family key
      const keyData = await getFamilyKey(token, familyId);
      const decryptedFamilyKey = decrypt(
        keyData.encryptedFamilyKey,
        keyData.encryptedFamilyKeyNonce,
        masterKey
      );
      setFamilyKey(decryptedFamilyKey);

      // If owner, load my credentials to share
      if (currentFamily.role === 'owner') {
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
      const sharedData = await getSharedCredentials(token, familyId);

      console.log('Shared credentials data:', sharedData);
      console.log('Family key available:', !!decryptedFamilyKey);

      // Decrypt shared credentials
      const decryptedShared = sharedData.credentials.map((cred) => {
        try {
          console.log('Processing shared credential:', {
            id: cred.id,
            hasContentKey: !!cred.encrypted_content_key,
            hasData: !!cred.encrypted_data
          });

          // Decrypt the content key with FAMILY KEY (not master key)
          const contentKey = decrypt(
            cred.encrypted_content_key,
            cred.encrypted_content_key_nonce,
            decryptedFamilyKey
          );

          if (!contentKey) {
            console.error('Failed to decrypt content key for credential:', cred.id);
            throw new Error('Content key decryption failed');
          }

          console.log('Content key decrypted successfully');

          // Decrypt credential data with content key
          const dataBytes = decrypt(
            cred.encrypted_data,
            cred.encrypted_data_nonce,
            contentKey
          );

          if (!dataBytes) {
            console.error('Failed to decrypt data for credential:', cred.id);
            throw new Error('Data decryption failed');
          }

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
            isMasked: currentFamily.role === 'member',
            owner_email: cred.owner_email,
          };
        } catch (err) {
          console.error('Failed to decrypt shared credential:', {
            id: cred.id,
            error: err.message,
            stack: err.stack
          });
          // Instead of filtering out, let's throw the error to see it
          throw new Error(`Failed to decrypt credential ${cred.id}: ${err.message}`);
        }
      }).filter(Boolean);

      setSharedCredentials(decryptedShared);
      setError('');
    } catch (err) {
      setError(err.message);
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
        selectedFamilyId,
        encryptedContentKey.ciphertext,
        encryptedContentKey.nonce
      );

      setSuccess('Credential shared successfully!');
      setSelectedCredential('');
      await loadFamilyData(selectedFamilyId);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (families.length === 0) {
    return (
      <div className="info-box">
        <p>You need to create or join a family first to share credentials.</p>
      </div>
    );
  }

  if (!selectedFamily) return null;

  return (
    <div className="credential-sharing">
      <h2>Shared Credentials</h2>

      <div className="form-group">
        <label>Select Family</label>
        <select
          value={selectedFamilyId}
          onChange={(e) => setSelectedFamilyId(e.target.value)}
        >
          {families.map(f => (
            <option key={f.id} value={f.id}>{f.name} ({f.role})</option>
          ))}
        </select>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {selectedFamily.role === 'owner' && (
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
        <h3>Shared with {selectedFamily.name}</h3>
        {sharedCredentials.length > 0 ? (
          <div className="credentials-list">
            {sharedCredentials.map((cred) => (
              <div key={cred.id} className="vault-entry">
                <div className="vault-entry-header">
                  <div className="vault-entry-url">{cred.url || 'No URL'}</div>
                  {selectedFamily.role === 'member' && (
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
