import React, { useState, useEffect } from 'react';
import {
  createFamily,
  getMyFamily,
  createInvite,
  joinFamily,
  removeMember,
  getFamilyKey,
} from '../api';
import { generateKey, encrypt, decrypt } from '../crypto';
import sodium from 'libsodium-wrappers';

function FamilyManagement({ token, masterKey }) {
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create family form
  const [familyName, setFamilyName] = useState('');

  // Join family form
  const [inviteToken, setInviteToken] = useState('');

  // Invite link
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    loadFamily();
  }, []);

  const loadFamily = async () => {
    try {
      setLoading(true);
      const data = await getMyFamily(token);
      setFamily(data.family);
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

  const handleCreateFamily = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // Generate a new random family key
      await sodium.ready;
      const familyKey = generateKey();

      // Encrypt the family key with owner's master key
      const encryptedFamilyKey = encrypt(familyKey, masterKey);

      const result = await createFamily(
        token,
        familyName,
        encryptedFamilyKey.ciphertext,
        encryptedFamilyKey.nonce
      );
      setSuccess('Family created successfully!');
      setFamilyName('');
      await loadFamily();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleJoinFamily = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await sodium.ready;

      console.log('Join family - Input:', inviteToken);
      console.log('Master key available:', !!masterKey);

      // Parse invite link to extract token and family key
      let inviteTokenOnly = inviteToken;
      let familyKeyBase64 = null;

      if (inviteToken.includes('?')) {
        // Full URL provided
        console.log('Parsing as URL...');
        const url = new URL(inviteToken);
        inviteTokenOnly = url.searchParams.get('token');
        familyKeyBase64 = url.searchParams.get('familyKey');
        console.log('Extracted token:', inviteTokenOnly);
        console.log('Extracted familyKey:', familyKeyBase64 ? 'present' : 'missing');
      }

      if (!inviteTokenOnly) {
        setError('Invalid invite link. Token not found.');
        return;
      }

      if (!familyKeyBase64) {
        setError('Invalid invite link. Family key not found. Make sure to paste the complete invite URL.');
        return;
      }

      if (!masterKey) {
        setError('Master key not available. Please log in again.');
        return;
      }

      // Decode family key from base64
      console.log('Decoding family key...');
      const familyKey = sodium.from_base64(decodeURIComponent(familyKeyBase64));
      console.log('Family key decoded, length:', familyKey.length);

      // Encrypt family key with new member's master key
      console.log('Encrypting with master key...');
      const encryptedFamilyKey = encrypt(familyKey, masterKey);
      console.log('Encrypted family key:', encryptedFamilyKey);

      console.log('Calling joinFamily API...');
      await joinFamily(
        token,
        inviteTokenOnly,
        encryptedFamilyKey.ciphertext,
        encryptedFamilyKey.nonce
      );
      setSuccess('Joined family successfully!');
      setInviteToken('');
      await loadFamily();
    } catch (err) {
      console.error('Join family error:', err);
      setError(err.message || 'Failed to join family');
    }
  };

  const handleGenerateInvite = async () => {
    setError('');
    setSuccess('');

    try {
      await sodium.ready;

      // Get owner's encrypted family key
      const keyData = await getFamilyKey(token, family.id);

      // Decrypt family key with owner's master key
      const familyKey = decrypt(
        keyData.encryptedFamilyKey,
        keyData.encryptedFamilyKeyNonce,
        masterKey
      );

      // Create invite token
      const result = await createInvite(token, family.id);

      // Include family key in the invite link (base64 encoded)
      const familyKeyBase64 = sodium.to_base64(familyKey);
      const link = `${window.location.origin}/join?token=${result.token}&familyKey=${encodeURIComponent(familyKeyBase64)}`;
      setInviteLink(link);
      setSuccess('Invite link generated! Share this with family members.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await removeMember(token, family.id, userId);
      setSuccess('Member removed successfully!');
      await loadFamily();
    } catch (err) {
      setError(err.message);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setSuccess('Invite link copied to clipboard!');
  };

  if (loading) {
    return <div className="loading">Loading family...</div>;
  }

  return (
    <div className="family-management">
      <h2>Family Sharing</h2>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {!family ? (
        <div>
          <div className="section">
            <h3>Create a Family</h3>
            <form onSubmit={handleCreateFamily}>
              <div className="form-group">
                <label>Family Name</label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="e.g., Smith Family"
                  required
                />
              </div>
              <button type="submit">Create Family</button>
            </form>
          </div>

          <div className="divider">OR</div>

          <div className="section">
            <h3>Join a Family</h3>
            <form onSubmit={handleJoinFamily}>
              <div className="form-group">
                <label>Invite Token</label>
                <input
                  type="text"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  placeholder="Paste invite token here"
                  required
                />
              </div>
              <button type="submit">Join Family</button>
            </form>
          </div>
        </div>
      ) : (
        <div>
          <div className="section">
            <h3>{family.name}</h3>
            <p className="info">
              You are the <strong>{family.role}</strong>
            </p>
          </div>

          {family.role === 'owner' && (
            <div className="section">
              <h3>Invite Members</h3>
              <button onClick={handleGenerateInvite}>Generate Invite Link</button>
              {inviteLink && (
                <div className="invite-link-container">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="invite-link"
                  />
                  <button onClick={copyInviteLink}>Copy</button>
                </div>
              )}
            </div>
          )}

          <div className="section">
            <h3>Family Members</h3>
            {family.members && family.members.length > 0 ? (
              <div className="members-list">
                {family.members.map((member) => (
                  <div key={member.id} className="member-item">
                    <div>
                      <div className="member-email">{member.email}</div>
                      <div className="member-role">{member.role}</div>
                    </div>
                    {family.role === 'owner' && member.role !== 'owner' && (
                      <button
                        className="delete"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="info">No members yet. Invite someone to join!</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FamilyManagement;
