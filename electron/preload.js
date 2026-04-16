const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  showConfirmDialog: (message) => ipcRenderer.invoke('show-confirm-dialog', message),
  crypto: {
    deriveMasterKey: (password, saltBase64) => ipcRenderer.sendSync('crypto:deriveMasterKey', password, saltBase64),
    clearMasterKey: () => ipcRenderer.sendSync('crypto:clearMasterKey'),
    generateKey: () => ipcRenderer.sendSync('crypto:generateKey'),
    destroyKey: (keyHandle) => ipcRenderer.sendSync('crypto:destroyKey', keyHandle),
    encrypt: (plaintext, keyHandle) => ipcRenderer.sendSync('crypto:encrypt', plaintext, keyHandle),
    decrypt: (ciphertextBase64, nonceBase64, keyHandle, returnAsHandle) => ipcRenderer.sendSync('crypto:decrypt', ciphertextBase64, nonceBase64, keyHandle, returnAsHandle),
    generateKeyPair: () => ipcRenderer.sendSync('crypto:generateKeyPair'),
    encryptForPublicKey: (plaintext, pk) => ipcRenderer.sendSync('crypto:encryptForPublicKey', plaintext, pk),
    decryptWithPrivateKey: (ciphertext, pk, sk) => ipcRenderer.sendSync('crypto:decryptWithPrivateKey', ciphertext, pk, sk)
  }
});
