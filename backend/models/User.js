const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  resetOtp: String,
  otpExpiry: Date,
});

module.exports = mongoose.model('User', userSchema);
