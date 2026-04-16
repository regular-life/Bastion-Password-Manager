import sodium from 'libsodium-wrappers';

await sodium.ready;

const isElectron = !!(window.electronAPI && window.electronAPI.crypto);

/**
 * Derive master key from password and salt
 */
export async function deriveMasterKey(password, saltBase64) {
  if (isElectron) {
    window.electronAPI.crypto.deriveMasterKey(password, saltBase64);
    return { _isHandle: true, id: 'MASTER_KEY' };
  }

  // Decode base64 salt using browser's atob (more reliable)
  const binaryString = atob(saltBase64);
  const salt = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    salt[i] = binaryString.charCodeAt(i);
  }

  // Combine password and salt
  const passwordBytes = sodium.from_string(password);
  const combined = new Uint8Array(passwordBytes.length + salt.length);
  combined.set(passwordBytes, 0);
  combined.set(salt, passwordBytes.length);

  // Hash to create 32-byte key
  return sodium.crypto_generichash(32, combined);
}

/**
 * Generate a random encryption key
 */
export function generateKey() {
  if (isElectron) {
    return window.electronAPI.crypto.generateKey();
  }
  return sodium.randombytes_buf(32);
}

/**
 * Generate a random salt
 */
export function generateSalt() {
  if (isElectron) {
    throw new Error("generateSalt not available in client space");
  }
  return sodium.randombytes_buf(16);
}

/**
 * Encrypt data using XChaCha20-Poly1305
 */
export function encrypt(plaintext, key) {
  if (isElectron) {
    const result = window.electronAPI.crypto.encrypt(plaintext, key);
    if (result && result.error) throw new Error(result.error);
    return result;
  }

  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const plaintextBytes = typeof plaintext === 'string'
    ? sodium.from_string(plaintext)
    : plaintext;

  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintextBytes, null, null, nonce, key
  );

  return {
    nonce: sodium.to_base64(nonce),
    ciphertext: sodium.to_base64(ciphertext),
  };
}

/**
 * Decrypt specifically to a Key Handle in Electron mode.
 */
export function decryptKey(ciphertextBase64, nonceBase64, key) {
  if (isElectron) {
    const result = window.electronAPI.crypto.decrypt(ciphertextBase64, nonceBase64, key, true);
    if (result && result.error) throw new Error(result.error);
    return result;
  }
  return decrypt(ciphertextBase64, nonceBase64, key);
}

/**
 * Decrypt data using XChaCha20-Poly1305
 */
export function decrypt(ciphertextBase64, nonceBase64, key) {
  if (isElectron) {
    const result = window.electronAPI.crypto.decrypt(ciphertextBase64, nonceBase64, key, false);
    if (result && result.error) throw new Error(result.error);
    return new Uint8Array(result);
  }

  const ciphertext = sodium.from_base64(ciphertextBase64);
  const nonce = sodium.from_base64(nonceBase64);

  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, ciphertext, null, nonce, key
  );
}

/**
 * Convert bytes to string
 */
export function bytesToString(bytes) {
  if (isElectron) {
    if (bytes instanceof ArrayBuffer) {
       bytes = new Uint8Array(bytes);
    }
    return new TextDecoder().decode(bytes);
  }
  return sodium.to_string(bytes);
}

/**
 * Securely clear sensitive data
 */
export function secureClear(data) {
  if (isElectron) {
    if (data && data._isHandle) {
      window.electronAPI.crypto.destroyKey(data);
    } else if (data instanceof Uint8Array || data instanceof Array) {
      for (let i = 0; i < data.length; i++) data[i] = 0;
    }
    return;
  }

  if (data instanceof Uint8Array || data instanceof Array) {
    for (let i = 0; i < data.length; i++) {
      data[i] = 0;
    }
  }
}

/**
 * Generate a public/private key pair for asymmetric encryption
 */
export function generateKeyPair() {
  if (isElectron) {
    const result = window.electronAPI.crypto.generateKeyPair();
    if (result && result.error) throw new Error(result.error);
    return {
      publicKey: new Uint8Array(result.publicKey),
      privateKey: result.privateKey
    };
  }

  const keyPair = sodium.crypto_box_keypair();
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

/**
 * Encrypt data with recipient's public key (sealed box)
 */
export function encryptForPublicKey(plaintext, recipientPublicKey) {
  if (isElectron) {
    const result = window.electronAPI.crypto.encryptForPublicKey(plaintext, recipientPublicKey);
    if (result && result.error) throw new Error(result.error);
    return result;
  }

  const plaintextBytes = typeof plaintext === 'string'
    ? sodium.from_string(plaintext)
    : plaintext;

  const ciphertext = sodium.crypto_box_seal(plaintextBytes, recipientPublicKey);
  return sodium.to_base64(ciphertext);
}

/**
 * Decrypt data with private key (sealed box)
 */
export function decryptWithPrivateKey(ciphertextBase64, publicKey, privateKey) {
  if (isElectron) {
    const result = window.electronAPI.crypto.decryptWithPrivateKey(ciphertextBase64, publicKey, privateKey);
    if (result && result.error) throw new Error(result.error);
    return result;
  }

  const ciphertext = sodium.from_base64(ciphertextBase64);
  const resultBytes = sodium.crypto_box_seal_open(ciphertext, publicKey, privateKey);
  return resultBytes;
}

/**
 * Convert to base64
 */
export function toBase64(data) {
  if (isElectron) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(data)));
  }
  return sodium.to_base64(data);
}

/**
 * Convert from base64
 */
export function fromBase64(base64) {
  if (isElectron) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  return sodium.from_base64(base64);
}
