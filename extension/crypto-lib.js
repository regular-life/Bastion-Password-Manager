// Crypto utilities for browser extension
// This is a simplified version that works in the extension context

let sodium;

async function initSodium() {
  if (!sodium) {
    // Import libsodium-wrappers
    const sodiumModule = await import('./libsodium-wrappers.js');
    await sodiumModule.ready;
    sodium = sodiumModule;
  }
  return sodium;
}

export async function decrypt(ciphertextBase64, nonceBase64, key) {
  const s = await initSodium();

  const ciphertext = s.from_base64(ciphertextBase64);
  const nonce = s.from_base64(nonceBase64);

  return s.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    ciphertext,
    null,
    nonce,
    key
  );
}

export async function bytesToString(bytes) {
  const s = await initSodium();
  return s.to_string(bytes);
}

export async function fromBase64(base64) {
  const s = await initSodium();
  return s.from_base64(base64);
}
