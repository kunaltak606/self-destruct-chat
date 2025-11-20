const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const { Server } = require('socket.io');
const User = require('./models/User');
const Message = require('./models/Message'); // You must create this file!

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] }
});

const PORT = 5000;

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/self_destruct_chat', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());

// Register route
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ error: 'Username already taken' });

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({ username, passwordHash });
    await newUser.save();

    return res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login route
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Invalid username or password' });

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) return res.status(400).json({ error: 'Invalid username or password' });

    // For now, just return success (add JWT here in future)
    return res.json({ message: 'Login successful', username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update public key route
app.post('/updatePublicKey', async (req, res) => {
  try {
    const { username, publicKey } = req.body;
    if (!username || !publicKey) return res.status(400).json({ error: 'Missing parameters' });

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.publicKey = publicKey;
    await user.save();

    res.json({ message: 'Public key updated' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get public key route - new addition
app.get('/userPublicKey/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({ username });

    if (!user || !user.publicKey) {
      return res.status(404).json({ error: "Public key not found for user" });
    }

    res.json({ publicKey: user.publicKey });

  } catch (error) {
    console.error("Error fetching public key:", error);
    res.status(500).json({ error: 'Server error' });
  }
});
app.get('/messages/:user1/:user2', async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    }).sort({ timestamp: 1 });

    res.json(messages);
  } catch(err) {
    console.error('Error fetching messages', err);
    res.status(500).json({ error: 'Server error' });
  }
});



// Socket.IO for real-time chat
io.on('connection', (socket) => {
  console.log('User connected: ' + socket.id);

  socket.on('join', (username) => {
    socket.join(username);
    console.log(`${username} joined their room`);
  });

const ttlSeconds = 60; // e.g., expire after 60 seconds

socket.on('send_message', async ({ sender, receiver, encryptedMessage, encryptedAESKey, iv, timestamp }) => {
  try {
    const expireAt = new Date(Date.now() + ttlSeconds * 1000);
    const message = new Message({
      sender,
      receiver,
      encryptedMessage,
      encryptedAESKey,
      iv,
      timestamp: timestamp || new Date(),
      expireAt
    });
    await message.save();
    io.to(receiver).emit('receive_message', message);
    socket.emit('message_sent', message);
  } catch (err) {
    console.error('Error saving message:', err);
  }
});



  socket.on('disconnect', () => {
    console.log('User disconnected: ' + socket.id);
  });
});

// Start server with HTTP + Socket.IO!
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
