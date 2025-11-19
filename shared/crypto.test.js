import { test } from 'node:test';
import assert from 'node:assert';
import {
  deriveMasterKey,
  generateSalt,
  generateKey,
  encrypt,
  decrypt,
  hashPasswordForAuth,
  verifyPasswordHash,
  secureClear,
  toBase64,
  fromBase64,
} from './crypto.js';

test('generateSalt should create 16-byte salt', () => {
  const salt = generateSalt();
  assert.strictEqual(salt.length, 16);
});

test('generateKey should create 32-byte key', () => {
  const key = generateKey();
  assert.strictEqual(key.length, 32);
});

test('deriveMasterKey should derive consistent key from password and salt', async () => {
  const password = 'test-password-123';
  const salt = generateSalt();

  const key1 = await deriveMasterKey(password, salt);
  const key2 = await deriveMasterKey(password, salt);

  assert.strictEqual(key1.length, 32);
  assert.deepStrictEqual(key1, key2);
});

test('deriveMasterKey should derive different keys for different salts', async () => {
  const password = 'test-password-123';
  const salt1 = generateSalt();
  const salt2 = generateSalt();

  const key1 = await deriveMasterKey(password, salt1);
  const key2 = await deriveMasterKey(password, salt2);

  assert.notDeepStrictEqual(key1, key2);
});

test('encrypt and decrypt should work with string data', () => {
  const plaintext = 'Hello, World!';
  const key = generateKey();

  const encrypted = encrypt(plaintext, key);
  assert.ok(encrypted.nonce);
  assert.ok(encrypted.ciphertext);

  const decrypted = decrypt(encrypted.ciphertext, encrypted.nonce, key);
  const decryptedString = new TextDecoder().decode(decrypted);

  assert.strictEqual(decryptedString, plaintext);
});

test('encrypt and decrypt should work with binary data', () => {
  const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
  const key = generateKey();

  const encrypted = encrypt(plaintext, key);
  const decrypted = decrypt(encrypted.ciphertext, encrypted.nonce, key);

  assert.deepStrictEqual(decrypted, plaintext);
});

test('decrypt should fail with wrong key', () => {
  const plaintext = 'Secret message';
  const key1 = generateKey();
  const key2 = generateKey();

  const encrypted = encrypt(plaintext, key1);

  assert.throws(() => {
    decrypt(encrypted.ciphertext, encrypted.nonce, key2);
  });
});

test('hashPasswordForAuth should create verifiable hash', async () => {
  const password = 'my-secure-password';
  const salt = generateSalt();

  const hash = await hashPasswordForAuth(password, salt);
  assert.ok(hash);
  assert.ok(hash.startsWith('$argon2id$'));
});

test('verifyPasswordHash should verify correct password', async () => {
  const password = 'my-secure-password';
  const salt = generateSalt();

  const hash = await hashPasswordForAuth(password, salt);
  const isValid = await verifyPasswordHash(hash, password);

  assert.strictEqual(isValid, true);
});

test('verifyPasswordHash should reject incorrect password', async () => {
  const password = 'my-secure-password';
  const wrongPassword = 'wrong-password';
  const salt = generateSalt();

  const hash = await hashPasswordForAuth(password, salt);
  const isValid = await verifyPasswordHash(hash, wrongPassword);

  assert.strictEqual(isValid, false);
});

test('secureClear should zero out array data', () => {
  const data = new Uint8Array([1, 2, 3, 4, 5]);
  secureClear(data);

  assert.deepStrictEqual(data, new Uint8Array([0, 0, 0, 0, 0]));
});

test('base64 encoding and decoding should be reversible', () => {
  const original = new Uint8Array([1, 2, 3, 4, 5]);
  const encoded = toBase64(original);
  const decoded = fromBase64(encoded);

  assert.deepStrictEqual(decoded, original);
});

test('encryption should produce different ciphertexts with same key', () => {
  const plaintext = 'Same message';
  const key = generateKey();

  const encrypted1 = encrypt(plaintext, key);
  const encrypted2 = encrypt(plaintext, key);

  // Nonces should be different
  assert.notStrictEqual(encrypted1.nonce, encrypted2.nonce);
  // Ciphertexts should be different
  assert.notStrictEqual(encrypted1.ciphertext, encrypted2.ciphertext);

  // But both should decrypt correctly
  const decrypted1 = decrypt(encrypted1.ciphertext, encrypted1.nonce, key);
  const decrypted2 = decrypt(encrypted2.ciphertext, encrypted2.nonce, key);

  assert.deepStrictEqual(decrypted1, decrypted2);
});
