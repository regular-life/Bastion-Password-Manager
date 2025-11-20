import React, { useState, useEffect } from 'react';
import {
  createFamily,
  getMyFamily,
  createInvite,
  joinFamily,
  removeMember,
  getFamilyKey,
  getFamilyMembers,
} from '../api';
import { generateKey, encrypt, decrypt } from '../crypto';
import sodium from 'libsodium-wrappers';

function FamilyManagement({ token, masterKey }) {
  const [families, setFamilies] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create family form
  const [familyName, setFamilyName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Join family form
  const [inviteToken, setInviteToken] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);

  // Invite link
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    loadFamilies();
  }, []);

  const loadFamilies = async () => {
    try {
      setLoading(true);
      const data = await getMyFamily(token);
      setFamilies(data.families || []);
      setError('');
    } catch (err) {
      console.error('Load families error:', err);
      // If 404, it just means no families, which is fine
      if (err.status === 404) {
        setFamilies([]);
      } else {
        setError(err.message || 'Failed to load families');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadFamilyDetails = async (family) => {
    try {
      setLoading(true);
      // Fetch members for this family
      // We need to use the new endpoint or the existing one if we updated it?
      // Actually, we can use the generic members endpoint we saw in the backend file:
      // GET /api/family/:familyId/members

      // Wait, we need to import a function to call this. 
      // Let's assume we can add `getFamilyMembers` to api.js or use `fetch` directly.
      // For now, let's check if `getFamilyMembers` exists in api.js.
      // If not, we'll need to add it.
      // Looking at the imports, it's not there.
      // I'll assume we need to add it to api.js first.

      // But wait, I can't edit api.js in this tool call.
      // I will implement a fetch here for now or use a placeholder and update api.js next.

      // Actually, I'll just use the `getMyFamily` endpoint logic but for a specific family?
      // No, the backend has `router.get('/:familyId/members', ...)`
      // I should add `getFamilyMembers` to `api.js` in the next step.
      // For now, I'll just set the selected family and we'll load members in a useEffect or separate function.

      setSelectedFamily(family);
      setInviteLink('');
      setSuccess('');
      setError('');

      // Fetch members
      const data = await getFamilyMembers(token, family.id);
      setFamilyMembers(data.members);

    } catch (err) {
      setError(err.message);
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
      setShowCreateForm(false);
      await loadFamilies();
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
      setShowJoinForm(false);
      await loadFamilies();
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
      const keyData = await getFamilyKey(token, selectedFamily.id);

      // Decrypt family key with owner's master key
      const familyKey = decrypt(
        keyData.encryptedFamilyKey,
        keyData.encryptedFamilyKeyNonce,
        masterKey
      );

      // Create invite token
      const result = await createInvite(token, selectedFamily.id);

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
      await removeMember(token, selectedFamily.id, userId);
      setSuccess('Member removed successfully!');
      // Reload members
      loadFamilyDetails(selectedFamily);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Family Sharing</h2>
        {selectedFamily && (
          <button className="secondary" onClick={() => setSelectedFamily(null)}>
            ← Back to Families
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {!selectedFamily ? (
        // List View
        <div>
          <div className="section">
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <button onClick={() => { setShowCreateForm(true); setShowJoinForm(false); }}>
                Create New Family
              </button>
              <button className="secondary" onClick={() => { setShowJoinForm(true); setShowCreateForm(false); }}>
                Join Existing Family
              </button>
            </div>

            {showCreateForm && (
              <div className="add-entry-form">
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
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="submit">Create Family</button>
                    <button type="button" className="secondary" onClick={() => setShowCreateForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {showJoinForm && (
              <div className="add-entry-form">
                <h3>Join a Family</h3>
                <form onSubmit={handleJoinFamily}>
                  <div className="form-group">
                    <label>Invite Token or Link</label>
                    <input
                      type="text"
                      value={inviteToken}
                      onChange={(e) => setInviteToken(e.target.value)}
                      placeholder="Paste invite token or full link here"
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="submit">Join Family</button>
                    <button type="button" className="secondary" onClick={() => setShowJoinForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <h3>Your Families</h3>
            {families.length === 0 ? (
              <div className="empty-state">
                <p>You are not a member of any family yet.</p>
                <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Create a new family or join an existing one using the buttons above.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
                {families.map((fam) => (
                  <div
                    key={fam.id}
                    className="family-card"
                    onClick={() => loadFamilyDetails(fam)}
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '1.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                          {fam.name}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.25rem 0.75rem',
                            background: fam.role === 'owner' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                            color: fam.role === 'owner' ? 'var(--primary-light)' : 'var(--text-muted)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            textTransform: 'capitalize',
                          }}>
                            {fam.role === 'owner' ? '👑 ' : ''}  {fam.role}
                          </span>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            color: 'var(--text-muted)',
                            fontSize: '0.9rem',
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                              <circle cx="9" cy="7" r="4"></circle>
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            {fam.memberCount} {fam.memberCount === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                      </div>
                      <div style={{
                        color: 'var(--text-muted)',
                        fontSize: '1.5rem',
                      }}>
                        →
                      </div>
                    </div>
                    <div style={{
                      paddingTop: '1rem',
                      borderTop: '1px solid var(--border)',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem',
                    }}>
                      Click to view members and manage this family
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        // Detail View
        <div>
          <div className="section">
            <h3>{selectedFamily.name}</h3>
            <p className="info">
              You are the <strong>{selectedFamily.role}</strong>
            </p>
          </div>

          {selectedFamily.role === 'owner' && (
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
            {familyMembers && familyMembers.length > 0 ? (
              <div className="members-list">
                {familyMembers.map((member) => (
                  <div key={member.id} className="member-item">
                    <div>
                      <div className="member-email">{member.email}</div>
                      <div className="member-role">{member.role}</div>
                    </div>
                    {selectedFamily.role === 'owner' && member.role !== 'owner' && (
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
