import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

// Helper functions
async function generateRSAKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  return keyPair;
}

async function exportPublicKey(publicKey) {
  const spki = await window.crypto.subtle.exportKey("spki", publicKey);
  const b64 = window.btoa(String.fromCharCode(...new Uint8Array(spki)));
  return b64;
}

async function exportPrivateKey(privateKey) {
  const pk = await window.crypto.subtle.exportKey('jwk', privateKey);
  return JSON.stringify(pk); // Save as JSON string in localStorage
}

export default function Login({ setUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await axios.post('http://localhost:5000/login', { username, password });
      if (res.data && res.data.message === 'Login successful') {

        let privateKeyJson = localStorage.getItem('privateKey');
        if (!privateKeyJson) {
          // No private key stored yet, generate new keys
          const keyPair = await generateRSAKeyPair();

          const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
          privateKeyJson = await exportPrivateKey(keyPair.privateKey);

          // Save private key locally
          localStorage.setItem('privateKey', privateKeyJson);

          // Send public key to backend
          await axios.post('http://localhost:5000/updatePublicKey', {
            username,
            publicKey: publicKeyBase64,
          });
        }

        // Now you have a persistent private key for this user session
        setUser(username);
        navigate('/chat');
      }
    } catch (err) {
      if (err.response && err.response.data.error) setError(err.response.data.error);
      else setError('Login failed');
    }
  };


  return (
    <div style={{ maxWidth: '400px', margin: 'auto', padding: '2rem' }}>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <input
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '1rem' }}
          required
        />
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '1rem' }}
          required
        />
        <button type="submit" style={{ width: '100%', padding: '8px' }}>
          Login
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
      <p>
        New user? <Link to="/register">Register here</Link>
      </p>
    </div>
  );
}
