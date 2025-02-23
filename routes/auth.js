const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const UserToken = require('../models/UserToken');
const router = express.Router();

const JWT_SECRET = 'your_jwt_secret';

// Register route
router.post('/register', async (req, res) => {
  const { fullName, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ fullName, email, password: hashedPassword });
  await user.save();
  res.status(201).send('User registered');
});

// Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).send('User not found');
  }
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).send('Invalid password');
  }
  const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// Forgot password route
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).send('User not found');
  }
  
  const resetToken = uuidv4();
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  
  await UserToken.create({
    userId: user._id,
    token: hashedToken,
    createdAt: new Date()
  });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'animashaunfaruq448@gmail.com',
      pass: 'ugtrnkvexanabhqe',
    },
  });

  const mailOptions = {
    from: 'animashaunfaruq448@gmail.com',
    to: email,
    subject: 'Password Reset',
    text: `You requested a password reset. Use the following token to reset your password: ${resetToken}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).send('Error sending email');
    }
    res.json({ msg: 'Email sent' });
  });
});

// Reset password route
router.post('/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  
  const userToken = await UserToken.findOne({ token: hashedToken });
  if (!userToken) {
    return res.status(400).send('Invalid or expired token');
  }

  const user = await User.findById(userToken.userId);
  if (!user) {
    return res.status(404).send('User not found');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  await user.save();
  
  await UserToken.deleteOne({ token: hashedToken });

  res.send('Password reset successful');
});

// Protected route
router.get('/profile', async (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  const decoded = jwt.verify(token, JWT_SECRET);
  const user = await User.findById(decoded.userId);
  if (!user) {
    return res.status(401).send('Unauthorized');
  }
  res.json({ fullName: user.fullName, email: user.email });
});

module.exports = router;
