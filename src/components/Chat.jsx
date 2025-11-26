import React, { useState, useEffect } from 'react';
import { io } from "socket.io-client";
import axios from "axios";

// Create Socket.IO client (connect to backend)
const socket = io('http://localhost:5000');

// Helper - Encrypt message with AES-GCM
async function encryptMessageAES(message) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const encodedMessage = new TextEncoder().encode(message);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encodedMessage
  );
  return { ciphertext, iv, aesKey };
}

// Helper - Export AES raw key to base64
async function exportAESKey(aesKey) {
  const rawKey = await window.crypto.subtle.exportKey("raw", aesKey);
  return window.btoa(String.fromCharCode(...new Uint8Array(rawKey)));
}

// Helper - Import RSA public key from base64 string
async function importRSAPublicKey(base64Key) {
  const binaryDerString = atob(base64Key);
  const binaryDer = Uint8Array.from(binaryDerString, c => c.charCodeAt(0));
  return await window.crypto.subtle.importKey(
    "spki",
    binaryDer.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

// Helper - Encrypt AES key with RSA public key and return base64
async function encryptAESKeyWithRSA(aesRawKeyBase64, rsaPublicKey) {
  const aesRawKey = Uint8Array.from(atob(aesRawKeyBase64), c => c.charCodeAt(0));
  const encryptedKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaPublicKey,
    aesRawKey
  );
  return window.btoa(String.fromCharCode(...new Uint8Array(encryptedKey)));
}

// Helper - Import private RSA key from JWK JSON string in localStorage
async function importRSAPrivateKey(jwkString) {
  const jwk = JSON.parse(jwkString);
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

// Helper - Decrypt AES key with private RSA key
async function decryptAESKeyWithRSA(encryptedAESKeyBase64, rsaPrivateKey) {
  const encryptedAESKey = Uint8Array.from(atob(encryptedAESKeyBase64), c => c.charCodeAt(0));
  const decryptedRawKey = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    rsaPrivateKey,
    encryptedAESKey
  );
  return decryptedRawKey;
}

// Helper - Import AES raw key to CryptoKey
async function importAESKey(rawKeyBuffer) {
  return await window.crypto.subtle.importKey(
    "raw",
    rawKeyBuffer,
    "AES-GCM",
    true,
    ["decrypt"]
  );
}

// Helper - Decrypt the message using AES key and Iv
async function decryptMessageAES(ciphertextBase64, ivBase64, aesKey) {
  const ciphertext = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  );
  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}


export default function Chat({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [receiver, setReceiver] = useState('');

  // Function to decrypt messages
const decryptMessage = async (encryptedMsg) => {
  try {
    const privKeyString = localStorage.getItem('privateKey');
    if (!privKeyString) throw new Error("Private key not found");
    console.log("Decrypting with private key", privKeyString);
    const privateKey = await importRSAPrivateKey(privKeyString);

    console.log('Encrypted AES key:', encryptedMsg.encryptedAESKey);
    const decryptedAESRawKey = await decryptAESKeyWithRSA(encryptedMsg.encryptedAESKey, privateKey);
    const aesKey = await importAESKey(decryptedAESRawKey);
    const plaintext = await decryptMessageAES(encryptedMsg.encryptedMessage, encryptedMsg.iv, aesKey);
    return plaintext;
  } catch (err) {
    console.error('Decryption error:', err);
    return "[Unable to decrypt]";
  }
};

// Existing effect: fetch on user or receiver change and handle socket receive

useEffect(() => {
  if (!user || !receiver) return;

  // Join socket room for the logged-in user
  socket.emit('join', user);

  // Fetch message history once on load or receiver change
  axios.get(`http://localhost:5000/messages/${user}/${receiver}`)
    .then(async res => {
      const decryptedMessages = await Promise.all(
        res.data.map(async (msg) => {
          const text = await decryptMessage(msg);
          return { ...msg, text };
        })
      );
      setMessages(decryptedMessages);
    })
    .catch(err => console.error('Failed to load messages:', err));

  // Handle incoming messages in real-time
  const handleReceiveMessage = async (encryptedMsg) => {
    const text = await decryptMessage(encryptedMsg);
    setMessages(prev => [...prev, { ...encryptedMsg, text }]);
  };

  socket.on('receive_message', handleReceiveMessage);

  return () => {
    socket.off('receive_message', handleReceiveMessage);
  };
}, [user, receiver]);


// Add polling effect: refresh messages every 30 seconds to reflect deletions
useEffect(() => {
  if (!user || !receiver) return;

  const intervalId = setInterval(() => {
    axios.get(`http://localhost:5000/messages/${user}/${receiver}`)
      .then(async res => {
        const decryptedMessages = await Promise.all(
          res.data.map(async (msg) => {
            const text = await decryptMessage(msg);
            return { ...msg, text };
          })
        );
        setMessages(decryptedMessages);
      })
      .catch(err => console.error('Failed to load messages:', err));
  }, 30000); // refresh every 30 seconds

  return () => clearInterval(intervalId);
}, [user, receiver]);


  const handleSend = async () => {
    if (!input.trim() || !receiver.trim()) return;

    try {
      const res = await axios.get(`http://localhost:5000/userPublicKey/${receiver}`);
      const receiverPublicKeyBase64 = res.data.publicKey;
      if (!receiverPublicKeyBase64) {
        alert("Receiver public key not found!");
        return;
      }

      const receiverPublicKey = await importRSAPublicKey(receiverPublicKeyBase64);
      const { ciphertext, iv, aesKey } = await encryptMessageAES(input);
      const aesRawKeyBase64 = await exportAESKey(aesKey);
      const encryptedAESKeyBase64 = await encryptAESKeyWithRSA(aesRawKeyBase64, receiverPublicKey);
      const ciphertextBase64 = window.btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
      const ivBase64 = window.btoa(String.fromCharCode(...new Uint8Array(iv)));

      socket.emit('send_message', {
        sender: user,
        receiver,
        encryptedMessage: ciphertextBase64,
        encryptedAESKey: encryptedAESKeyBase64,
        iv: ivBase64,
        timestamp: new Date()
      });

      setInput('');
    } catch (err) {
      console.error('Encryption or sending failed', err);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: 'auto', padding: '20px' }}>
      <h2>Welcome, {user}</h2>
      <div style={{ marginBottom: '1rem' }}>
        <input
          placeholder="Send message to (username)"
          value={receiver}
          onChange={e => setReceiver(e.target.value)}
          style={{ width: '300px', marginRight: '10px', padding: '8px' }}
        />
      </div>
      <div
        style={{
          height: '300px',
          overflowY: 'auto',
          border: '1px solid gray',
          padding: '10px',
          marginBottom: '1rem',
        }}
      >
        {messages
          .filter(msg => msg.receiver === user || msg.sender === user)
          .map(msg => (
              <div key={msg._id} style={{ marginBottom: '10px' }}>
              <b>{msg.sender} → {msg.receiver}:</b> {msg.text}
              <br />
              <small>{new Date(msg.timestamp).toLocaleString()}</small>
            </div>
          ))}
      </div>
      <div>
        <input
          placeholder="Type your message"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          style={{ width: '400px', marginRight: '10px', padding: '8px' }}
        />
        <button onClick={handleSend} style={{ padding: '8px 16px' }}>
          Send
        </button>
      </div>
    </div>
  );
}

