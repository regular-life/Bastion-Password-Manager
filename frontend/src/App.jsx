import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Vault from './components/Vault';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [masterKey, setMasterKey] = useState(null);

  useEffect(() => {
    // Check if user is already logged in
    const storedToken = sessionStorage.getItem('token');
    const storedUser = sessionStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = async (userData, authToken, key) => {
    setUser(userData);
    setToken(authToken);
    setMasterKey(key);

    sessionStorage.setItem('token', authToken);
    sessionStorage.setItem('user', JSON.stringify(userData));

    // Store master key in Electron if available
    if (window.electronAPI) {
      await window.electronAPI.setMasterKey(Array.from(key));
    }
  };

  const handleLogout = async () => {
    // Clear sensitive data
    if (masterKey) {
      for (let i = 0; i < masterKey.length; i++) {
        masterKey[i] = 0;
      }
    }

    // Clear master key from Electron if available
    if (window.electronAPI) {
      await window.electronAPI.clearMasterKey();
    }

    setUser(null);
    setToken(null);
    setMasterKey(null);

    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  };

  return (
    <div className="app">
      {!user ? (
        <Auth onLogin={handleLogin} />
      ) : (
        <Vault
          user={user}
          token={token}
          masterKey={masterKey}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
