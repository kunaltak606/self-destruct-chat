const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  publicKey: { type: String }   // <--- Add this to store base64 public key
});


module.exports = mongoose.model('User', UserSchema);
