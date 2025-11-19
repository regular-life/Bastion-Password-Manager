import sodium from 'libsodium-wrappers';

await sodium.ready;

/**
 * Derive master key from password and salt
 * Using a simple hash since crypto_pwhash has issues
 */
export async function deriveMasterKey(password, saltBase64) {
  // Decode base64 salt using browser's atob (more reliable)
  const binaryString = atob(saltBase64);
  const salt = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    salt[i] = binaryString.charCodeAt(i);
  }

  console.log('Salt decoded, length:', salt.length, 'bytes');

  // Combine password and salt
  const passwordBytes = sodium.from_string(password);
  const combined = new Uint8Array(passwordBytes.length + salt.length);
  combined.set(passwordBytes, 0);
  combined.set(salt, passwordBytes.length);

  console.log('Combined length:', combined.length);

  // Hash to create 32-byte key
  const key = sodium.crypto_generichash(32, combined);

  console.log('Key generated, length:', key.length);

  return key;
}

/**
 * Generate a random encryption key
 */
export function generateKey() {
  return sodium.randombytes_buf(32);
}

/**
 * Encrypt data using XChaCha20-Poly1305
 */
export function encrypt(plaintext, key) {
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const plaintextBytes = typeof plaintext === 'string'
    ? sodium.from_string(plaintext)
    : plaintext;

  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintextBytes,
    null,
    null,
    nonce,
    key
  );

  return {
    nonce: sodium.to_base64(nonce),
    ciphertext: sodium.to_base64(ciphertext),
  };
}

/**
 * Decrypt data using XChaCha20-Poly1305
 */
export function decrypt(ciphertextBase64, nonceBase64, key) {
  const ciphertext = sodium.from_base64(ciphertextBase64);
  const nonce = sodium.from_base64(nonceBase64);

  const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    ciphertext,
    null,
    nonce,
    key
  );

  return plaintext;
}

/**
 * Convert bytes to string
 */
export function bytesToString(bytes) {
  return sodium.to_string(bytes);
}

/**
 * Securely clear sensitive data
 */
export function secureClear(data) {
  if (data instanceof Uint8Array || data instanceof Array) {
    for (let i = 0; i < data.length; i++) {
      data[i] = 0;
    }
  }
}
