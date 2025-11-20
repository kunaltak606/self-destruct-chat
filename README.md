# 🔐 Self-Destructing Encrypted Chat

A real-time chat application with end-to-end RSA/AES encryption and self-destructing messages. Built using React, Node.js, Express, MongoDB, and Socket.IO.

***

## Features

- End-to-end encryption using RSA and AES
- Self-destructing messages (auto-delete from DB after 1 minute)
- Real-time chat using Socket.IO
- User authentication with password hashing
- Clean React + Express full-stack codebase

***

## Getting Started

### Prerequisites

- Node.js (v16 or above recommended)
- MongoDB Community Server (running on default `mongodb://localhost:27017/`)
- npm (Node package manager)

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/kunaltak606/self-destruct-chat.git
   cd self-destruct-chat
   ```

2. **Install dependencies:**

   - In `/backend`:

     ```bash
     cd backend
     npm install
     ```

   - In `/self-destruct-chat`:

     ```bash
     cd ../self-destruct-chat
     npm install
     ```

3. **Configure (if needed):**

   - Update database connection string in `backend/server.js` if you use a different host.

4. **Run MongoDB:**

   > Make sure MongoDB is running locally (`mongod`) before starting the servers.

5. **Start the backend server:**

   ```bash
   cd backend
   npm start
   ```

6. **Start the frontend server:**

   ```bash
   cd ../self-destruct-chat
   npm run dev
   ```

7. Open [http://localhost:5173](http://localhost:5173) in your browser.

***

## Usage

- Register with a username & password.
- Login; key pair is generated and private key is saved in your browser.
- Start a conversation by entering another registered username.
- Messages are encrypted and will self-destruct automatically after ~1 minute.
- If you reload, only surviving messages (less than 1 minute old) will appear.

***

## Project Structure

```
├── backend/
│   ├── models/
│   │   ├── User.js
│   │   └── Message.js
│   ├── server.js
├── self-destruct-chat/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat.jsx
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   └── App.jsx
│   └── ...
└── README.md
```

***

## How Encryption Works

- Each user generates an RSA key pair after login/register.
- Public key is sent to backend for secure message delivery.
- Messages are encrypted client-side using a random AES key, which is itself encrypted with the recipient's public RSA key.
- The AES-encrypted message, RSA-encrypted AES key, and IV are sent/stored in the database.
- Recipient decrypts AES key using their private RSA key, then decrypts the message.

***

## Self-Destructing Messages

- Each message in MongoDB has an `expireAt` field and a TTL index.
- MongoDB automatically deletes messages after 1 minute.
- Reloading/switching to a chat only shows messages not yet expired.

***

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for more information.

***

## Contributors

- [KUNAL TAK](https://github.com/kunaltak606)

***

## Notes

- For security, **private keys are never sent to the server**.
- Only public keys are stored server-side for encryption purposes.
- For development use only—review, audit and adapt for production!

