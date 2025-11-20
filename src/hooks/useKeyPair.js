import { useState, useEffect } from 'react';

export default function useKeyPair() {
  const [publicKey, setPublicKey] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);

  useEffect(() => {
    async function generateKeys() {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true, // extractable
        ["encrypt", "decrypt"]
      );
      setPrivateKey(keyPair.privateKey);
      setPublicKey(keyPair.publicKey);
      
      // Convert keys to exportable format if you want to save/send later
      // exportKey example later
    }

    generateKeys();
  }, []);

  return { publicKey, privateKey };
}
