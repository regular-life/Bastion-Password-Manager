import sodium from 'libsodium-wrappers';
import argon2 from 'argon2';

await sodium.ready;

export const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

/**
 * Derive a master key from a password using Argon2id
 * @param {string} password - User's master password
 * @param {Uint8Array} salt - Salt (16 bytes minimum)
 * @returns {Promise<Uint8Array>} Derived key (32 bytes)
 */
export async function deriveMasterKey(password, salt) {
  const hash = await argon2.hash(password, {
    ...ARGON2_CONFIG,
    salt: Buffer.from(salt),
    raw: true,
  });
  return new Uint8Array(hash);
}

/**
 * Generate a random salt for Argon2id
 * @returns {Uint8Array} Random salt (16 bytes)
 */
export function generateSalt() {
  return sodium.randombytes_buf(16);
}

/**
 * Generate a random encryption key
 * @returns {Uint8Array} Random key (32 bytes)
 */
export function generateKey() {
  return sodium.randombytes_buf(32);
}

/**
 * Encrypt data using XChaCha20-Poly1305
 * @param {Uint8Array|string} plaintext - Data to encrypt
 * @param {Uint8Array} key - Encryption key (32 bytes)
 * @returns {object} Object containing nonce and ciphertext
 */
export function encrypt(plaintext, key) {
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const plaintextBytes = typeof plaintext === 'string'
    ? sodium.from_string(plaintext)
    : plaintext;

  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintextBytes,
    null, // no additional data
    null, // no secret nonce
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
 * @param {string} ciphertextBase64 - Base64 encoded ciphertext
 * @param {string} nonceBase64 - Base64 encoded nonce
 * @param {Uint8Array} key - Decryption key (32 bytes)
 * @returns {Uint8Array} Decrypted plaintext
 */
export function decrypt(ciphertextBase64, nonceBase64, key) {
  const ciphertext = sodium.from_base64(ciphertextBase64);
  const nonce = sodium.from_base64(nonceBase64);

  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, // no secret nonce
    ciphertext,
    null, // no additional data
    nonce,
    key
  );
}

/**
 * Hash password for server-side authentication (using Argon2id)
 * This is separate from the master key derivation
 * @param {string} password - User's password
 * @param {Uint8Array} salt - Salt for hashing
 * @returns {Promise<string>} Hash string
 */
export async function hashPasswordForAuth(password, salt) {
  return argon2.hash(password, {
    ...ARGON2_CONFIG,
    salt: Buffer.from(salt),
  });
}

/**
 * Verify password hash for server-side authentication
 * @param {string} hash - Stored hash
 * @param {string} password - Password to verify
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPasswordHash(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    return false;
  }
}

/**
 * Securely clear sensitive data from memory
 * @param {Uint8Array|Array} data - Data to clear
 */
export function secureClear(data) {
  if (data instanceof Uint8Array || data instanceof Array) {
    for (let i = 0; i < data.length; i++) {
      data[i] = 0;
    }
  }
}

/**
 * Encode data to base64
 * @param {Uint8Array} data
 * @returns {string}
 */
export function toBase64(data) {
  return sodium.to_base64(data);
}

/**
 * Decode data from base64
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function fromBase64(base64) {
  return sodium.from_base64(base64);
}
