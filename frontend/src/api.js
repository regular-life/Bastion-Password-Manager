const API_BASE = 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(error.error || 'Request failed', response.status);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function signup(email, password) {
  return request('/users/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email, password) {
  return request('/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getVaultEntries(token) {
  return request('/vault', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createVaultEntry(token, entry) {
  return request('/vault', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(entry),
  });
}

export async function updateVaultEntry(token, id, entry) {
  return request(`/vault/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(entry),
  });
}

export async function deleteVaultEntry(token, id) {
  return request(`/vault/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// Family Management
export async function createFamily(token, familyName, encryptedFamilyKey, encryptedFamilyKeyNonce) {
  return request('/family/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ familyName, encryptedFamilyKey, encryptedFamilyKeyNonce }),
  });
}

export async function getMyFamily(token) {
  return request('/family/my-family', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createInvite(token, familyId) {
  return request('/family/invite', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ familyId }),
  });
}

export async function joinFamily(token, inviteToken, encryptedFamilyKey, encryptedFamilyKeyNonce) {
  return request('/family/join', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ token: inviteToken, encryptedFamilyKey, encryptedFamilyKeyNonce }),
  });
}

export async function getFamilyKey(token, familyId) {
  return request(`/family/${familyId}/key`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function removeMember(token, familyId, userId) {
  return request('/family/remove-member', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ familyId, userId }),
  });
}

// Credential Sharing
export async function shareCredential(token, credentialId, familyId, encryptedContentKey, encryptedContentKeyNonce) {
  return request('/sharing/share', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      credentialId,
      familyId,
      encrypted_content_key: encryptedContentKey,
      encrypted_content_key_nonce: encryptedContentKeyNonce,
    }),
  });
}

export async function getSharedCredentials(token, familyId) {
  return request(`/sharing/shared?familyId=${familyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function requestFillToken(token, sharedCredId, origin) {
  return request('/sharing/request-fill-token', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sharedCredId, origin }),
  });
}

export async function getAuditLog(token, familyId) {
  return request(`/sharing/audit/${familyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// Password Generation
export async function generatePassword(requirements) {
  return request('/password/generate', {
    method: 'POST',
    body: JSON.stringify({ requirements }),
  });
}
