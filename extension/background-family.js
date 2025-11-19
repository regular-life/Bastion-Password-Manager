// Family sharing and masked autofill handlers

const API_BASE = 'http://localhost:3001/api';

/**
 * Get shared credentials for current user's families
 */
async function handleGetSharedCredentials(currentUrl) {
  try {
    const { token } = await chrome.storage.local.get('token');

    if (!token) {
      throw new Error('Not logged in');
    }

    // Get user's families
    const familiesResponse = await fetch(`${API_BASE}/family`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!familiesResponse.ok) {
      throw new Error('Failed to fetch families');
    }

    const { families } = await familiesResponse.json();

    // Get shared credentials from all families
    const allShared = [];

    for (const family of families) {
      try {
        const shareResponse = await fetch(
          `${API_BASE}/sharing/family/${family.id}/shared`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (shareResponse.ok) {
          const { shared_credentials } = await shareResponse.json();

          // Filter by URL if provided
          for (const cred of shared_credentials) {
            if (currentUrl && cred.encrypted_url) {
              // Check if URL matches (simplified check)
              allShared.push({
                ...cred,
                familyId: family.id,
                familyName: family.name,
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch shared for family:', family.id, err);
      }
    }

    return { credentials: allShared };
  } catch (error) {
    throw error;
  }
}

/**
 * Request masked fill for a shared credential
 * Uses delegation token flow - member never sees plaintext password
 */
async function handleMaskedFill(sharedCredentialId, origin) {
  try {
    const { token } = await chrome.storage.local.get('token');

    if (!token) {
      throw new Error('Not logged in');
    }

    // Request fill token from server
    const tokenResponse = await fetch(`${API_BASE}/sharing/request-fill-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sharedCredentialId,
        origin,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      throw new Error(error.error || 'Failed to request fill token');
    }

    const {
      fillToken,
      signature,
      encryptedCredential,
      encryptedCredentialNonce,
      ephemeralKey,
      expiresAt,
    } = await tokenResponse.json();

    // Import crypto utilities
    const { decrypt, bytesToString, fromBase64 } = await import('./crypto-lib.js');

    // Decrypt credential using ephemeral key (in memory only)
    const keyBytes = fromBase64(ephemeralKey);
    const credentialBytes = await decrypt(
      encryptedCredential,
      encryptedCredentialNonce,
      keyBytes
    );

    const credential = JSON.parse(await bytesToString(credentialBytes));

    // Immediately zero out the ephemeral key
    for (let i = 0; i < keyBytes.length; i++) {
      keyBytes[i] = 0;
    }

    // Mark token as used
    await fetch(`${API_BASE}/sharing/use-fill-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: fillToken }),
    });

    // Return credential data (will be cleared after use by content script)
    return {
      username: credential.username,
      password: credential.password,
      fillToken,
      expiresAt,
    };
  } catch (error) {
    throw error;
  }
}

// Export functions for use in background.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleGetSharedCredentials,
    handleMaskedFill,
  };
}
