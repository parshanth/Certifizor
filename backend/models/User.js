const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  Organization:String,
  email: String,
  password: String,
  resetOtp: String,
  otpExpiry: Date,
  admin: {
    type: Boolean,
    default: false
  },
  isApproved: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('User', userSchema);
