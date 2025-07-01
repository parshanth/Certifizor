const express = require('express');
const router = express.Router();
const User = require('../models/User');
const nodemailer = require('nodemailer');

// ✅ Send OTP
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) return res.send("User not found");

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.resetOtp = otp;
  user.otpExpiry = Date.now() + 10 * 60 * 1000;
  await user.save();

  // 📨 Send Email (configure transporter with real credentials)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-password',
    },
  });

  await transporter.sendMail({
    to: email,
    subject: 'Your OTP for password reset',
    text: `Your OTP is: ${otp}`,
  });

  res.redirect(`/verify-otp?email=${email}`);
});

// ✅ Verify OTP
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email });

  if (!user || user.resetOtp !== otp || Date.now() > user.otpExpiry) {
    return res.send("Invalid or expired OTP");
  }

  res.redirect(`/reset-password?email=${email}`);
});

// ✅ Reset Password
router.post('/reset-password', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user) return res.send("User not found");

  user.password = password; // Hash in real app!
  user.resetOtp = null;
  user.otpExpiry = null;
  await user.save();

  res.send("Password reset successful. You can now login.");
});

module.exports = router;
