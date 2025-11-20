import React, { useState, useEffect } from 'react';
import {
    setupRecoveryKeypair,
    getRecoveryKeypair,
    getTrustedContacts,
    addTrustedContact,
    removeTrustedContact,
    getUserPublicKey,
    getPendingRecoveryRequests,
    approveRecoveryRequest,
    getRecoveryRequestData,
    getMyFamily,
} from '../api';
import {
    generateKeyPair,
    encrypt,
    decrypt,
    encryptForPublicKey,
    decryptWithPrivateKey,
    toBase64,
    fromBase64,
    secureClear,
    bytesToString,
} from '../crypto';

function RecoveryManagement({ token, masterKey, user }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [hasKeypair, setHasKeypair] = useState(false);
    const [trustedContacts, setTrustedContacts] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [familyMembers, setFamilyMembers] = useState([]);

    const [selectedMemberId, setSelectedMemberId] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Check if user has recovery keypair
            try {
                await getRecoveryKeypair(token);
                setHasKeypair(true);
            } catch (err) {
                setHasKeypair(false);
            }

            // Get trusted contacts
            const contactsData = await getTrustedContacts(token);
            setTrustedContacts(contactsData.contacts || []);

            // Get pending recovery requests
            const requestsData = await getPendingRecoveryRequests(token);
            setPendingRequests(requestsData.requests || []);

            // Get family members
            try {
                const familyData = await getMyFamily(token);
                setFamilyMembers(familyData.family.members || []);
            } catch (err) {
                // No family yet
                setFamilyMembers([]);
            }
        } catch (err) {
            console.error('Load recovery data error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSetupKeypair = async () => {
        setError('');
        setSuccess('');

        try {
            // Generate new keypair
            const keyPair = generateKeyPair();

            // Encrypt private key with user's master key
            const encryptedPrivateKey = encrypt(keyPair.privateKey, masterKey);

            // Send to server
            await setupRecoveryKeypair(
                token,
                toBase64(keyPair.publicKey),
                encryptedPrivateKey.ciphertext,
                encryptedPrivateKey.nonce
            );

            setSuccess('Recovery keypair set up successfully!');
            setHasKeypair(true);

            // Clear sensitive data
            secureClear(keyPair.privateKey);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleAddTrustedContact = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!selectedMemberId) {
            setError('Please select a family member');
            return;
        }

        try {
            // Get the trusted contact's public key
            const { publicKey } = await getUserPublicKey(token, selectedMemberId);

            // Encrypt our master key with their public key
            const encryptedMasterKey = encryptForPublicKey(masterKey, fromBase64(publicKey));

            // Store on server
            await addTrustedContact(token, selectedMemberId, encryptedMasterKey);

            setSuccess('Trusted contact added successfully!');
            setSelectedMemberId('');
            await loadData();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleRemoveTrustedContact = async (contactId) => {
        if (!confirm('Are you sure you want to remove this trusted contact?')) {
            return;
        }

        setError('');
        setSuccess('');

        try {
            await removeTrustedContact(token, contactId);
            setSuccess('Trusted contact removed successfully!');
            await loadData();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleApproveRequest = async (request) => {
        setError('');
        setSuccess('');

        try {
            // Get our recovery keypair
            const keypairData = await getRecoveryKeypair(token);

            // Decrypt our private key with our master key
            const privateKey = decrypt(
                keypairData.encryptedPrivateKey,
                keypairData.encryptedPrivateKeyNonce,
                masterKey
            );

            // Get the encrypted master key from the recovery request
            const requestData = await getRecoveryRequestData(token, request.id);

            // Decrypt the requester's master key with our private key
            const requesterMasterKey = decryptWithPrivateKey(
                requestData.encryptedMasterKey,
                fromBase64(keypairData.publicKey),
                privateKey
            );

            // Re-encrypt the requester's master key with their public key
            // so they can decrypt it when they complete recovery
            // For now, we'll use a simple encryption with a temporary approach
            // In production, the requester would provide an ephemeral public key
            const reEncrypted = encrypt(requesterMasterKey, masterKey);

            // Approve the request
            await approveRecoveryRequest(
                token,
                request.id,
                reEncrypted.ciphertext,
                reEncrypted.nonce
            );

            setSuccess('Recovery request approved!');

            // Clear sensitive data
            secureClear(privateKey);
            secureClear(requesterMasterKey);

            await loadData();
        } catch (err) {
            console.error('Approve request error:', err);
            setError(err.message);
        }
    };

    if (loading) {
        return <div className="loading">Loading recovery settings...</div>;
    }

    return (
        <div className="recovery-container">
            <h2>Account Recovery</h2>

            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}

            {/* Setup Keypair */}
            <div className="section">
                <h3>Recovery Keypair</h3>
                {!hasKeypair ? (
                    <div>
                        <p>Set up recovery keys to enable account recovery through trusted contacts.</p>
                        <button onClick={handleSetupKeypair}>Setup Recovery Keys</button>
                    </div>
                ) : (
                    <div>
                        <p>✅ Recovery keys are set up.</p>
                        <button onClick={handleSetupKeypair}>Regenerate Recovery Keys</button>
                    </div>
                )}
            </div>

            {/* Add Trusted Contacts */}
            {hasKeypair && (
                <div className="section">
                    <h3>Trusted Contacts</h3>
                    <p>These family members can help you recover your account if you forget your password.</p>

                    <form onSubmit={handleAddTrustedContact} style={{ marginBottom: '20px' }}>
                        <div className="form-group">
                            <label>Select Family Member</label>
                            <select
                                value={selectedMemberId}
                                onChange={(e) => setSelectedMemberId(e.target.value)}
                                required
                            >
                                <option value="">-- Select --</option>
                                {familyMembers
                                    .filter(m =>
                                        !trustedContacts.some(tc => tc.trusted_contact_id === m.id) &&
                                        m.email !== user.email  // Exclude current user
                                    )
                                    .map(member => (
                                        <option key={member.id} value={member.id}>{member.email}</option>
                                    ))}
                            </select>
                        </div>
                        <button type="submit">Add Trusted Contact</button>
                    </form>

                    {trustedContacts.length === 0 ? (
                        <p>No trusted contacts yet.</p>
                    ) : (
                        <div className="trusted-contacts-list">
                            {trustedContacts.map(contact => (
                                <div key={contact.id} className="trusted-contact-item">
                                    <div>
                                        <strong>{contact.email}</strong>
                                        <span style={{ marginLeft: '10px', color: contact.is_active ? 'green' : 'red' }}>
                                            {contact.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveTrustedContact(contact.id)}
                                        className="delete"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Pending Recovery Requests */}
            {hasKeypair && pendingRequests.length > 0 && (
                <div className="section">
                    <h3>Pending Recovery Requests</h3>
                    <p>These users are requesting your help to recover their accounts.</p>

                    <div className="recovery-requests-list">
                        {pendingRequests.map(request => (
                            <div key={request.id} className="recovery-request-item">
                                <div>
                                    <strong>{request.requester_email}</strong>
                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                        Requested: {new Date(request.created_at).toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                        Expires: {new Date(request.expires_at).toLocaleString()}
                                    </div>
                                </div>
                                <button onClick={() => handleApproveRequest(request)}>
                                    Approve Request
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default RecoveryManagement;
