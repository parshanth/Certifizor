const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const fs = require('fs');

const connectDB = require('./config/db');
const Student = require('./models/student');
const User = require('./models/User');
const studentRoutes = require('./routes/student.routes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// EJS and Layout Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Global layout variable
app.use((req, res, next) => {
  res.locals.pageTitle = 'Certifizor';
  next();
});


// Login
app.get('/pages/login', (req, res) => {
  res.render('pages/login', { layout: false });
});

// Signup
app.get('/pages/signup', (req, res) => {
  res.render('pages/signup', { layout: false });
});

// Forgot Password
app.get('/forgot-password', (req, res) => {
  res.render('pages/forgot-password', { layout: false });
});

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.send('User not found');

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.resetOtp = otp;
  user.otpExpiry = Date.now() + 10 * 60 * 1000;
  await user.save();

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    to: email,
    subject: 'OTP for Password Reset',
    text: `Your OTP is: ${otp}`
  });

  res.redirect(`/verify-otp?email=${email}`);
});

// Verify OTP
app.get('/verify-otp', (req, res) => {
  res.render('pages/verify-otp', { email: req.query.email, layout: false });
});

app.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email });

  if (!user || user.resetOtp !== otp || Date.now() > user.otpExpiry) {
    return res.send('Invalid or expired OTP');
  }

  res.redirect(`/reset-password?email=${email}`);
});

// Reset Password
app.get('/reset-password', (req, res) => {
  res.render('pages/reset-password', { email: req.query.email, layout: false });
});

app.post('/reset-password', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.send('User not found');

  user.password = password; // ⚠️ You should hash this in production
  user.resetOtp = null;
  user.otpExpiry = null;
  await user.save();

  res.send('✅ Password updated! <a href="/pages/login">Login</a>');
});


// Redirect root to login
app.get('/', (req, res) => {
  res.redirect('/pages/login');
});



// Home Page
app.get('/home', async (req, res) => {
  try {
    const students = await Student.find();

    const today = new Date();
    const mappedStudents = students.map(s => {
      // Parse the 'to' date (format: DD/MM/YYYY)
      const [day, month, year] = s.to.split('/');
      const endDate = new Date(`${year}-${month}-${day}T23:59:59`);

      return {
        name: s.name,
        studentId: s.certId || s._id,
        email: s.email,
        from: s.from,         // <-- ADD THIS
        to: s.to,             // <-- ADD THIS
        internshipCompleted: today >= endDate,
        certificateSent: s.printed || false,
        _id: s._id,
      };
    });

    res.render('pages/home', {
      pageTitle: 'Home',
      students: mappedStudents,
    });
  } catch (err) {
    console.error('Failed to load students:', err);
    res.status(500).send('Error loading students');
  }
});

// Edit Template Page
app.get('/edit-template', (req, res) => {
  res.render('pages/edit-template', { pageTitle: 'Edit Template' });
});

// Manage Students Page
app.get('/manage', async (req, res) => {
  try {
    const students = await Student.find();

    const mappedStudents = students.map(s => ({
      _id: s._id,
      name: s.name,
      studentId: s.certId || s._id,
      status: s.Offered ? 'Completed' : 'Pending',
    }));

    res.render('pages/manage', {
      pageTitle: 'Manage Students',
      students: mappedStudents,
    });
  } catch (err) {
    console.error('Error fetching students for manage page:', err);
    res.status(500).send('Failed to load student data');
  }
});
app.post('/manage', async (req, res) => {
  const { name, email, from, to, phone } = req.body;
  if (!name || !email || !from || !to || !phone) {
    // Optionally, you can show an error message on the page
    return res.status(400).send('All fields are required');
  }
  try {
    const existing = await Student.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      // Optionally, you can show an error message on the page
      return res.status(409).send('Email or phone already exists');
    }
    const student = new Student({ name, email, from, to, phone });
    await student.save();
    res.redirect('/manage'); // Refresh the page to show the new student
  } catch (err) {
    console.error('Failed to add student:', err);
    res.status(500).send('Failed to add student');
  }
});
app.post('/manage/delete/:id', async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.redirect('/manage');
  } catch (err) {
    res.status(500).send('Failed to delete student');
  }
});

// Show edit form
app.get('/manage/edit/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).send('Student not found');
    res.render('pages/edit-student', { student, pageTitle: 'Edit Student' });
  } catch (err) {
    res.status(500).send('Failed to load student');
  }
});

// Handle update
app.post('/manage/edit/:id', async (req, res) => {
  const { name, email, from, to, phone } = req.body;
  try {
    await Student.findByIdAndUpdate(req.params.id, { name, email, from, to, phone });
    res.redirect('/manage');
  } catch (err) {
    res.status(500).send('Failed to update student');
  }
});

// Report Page
app.get('/report', async (req, res) => {
  try {
    const students = await Student.find();

    const totalStudents = students.length;
    const certificatesSent = students.filter(s => s.printed).length;
    const offerLettersSent = students.filter(s => s.Offered).length;

    const mappedStudents = students.map(s => ({
      name: s.name,
      studentId: s.certId || s._id,
      certificateSent: s.printed,
      offerLetterSent: s.Offered,
    }));

    res.render('pages/report', {
      pageTitle: 'Report',
      totalStudents,
      certificatesSent,
      offerLettersSent,
      students: mappedStudents,
    });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).send('Failed to load report data');
  }
});

// Certificate Verification Page
app.get('/verify/:id', (req, res) => {
  const certId = req.params.id;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Certificate Verification</title>
      <style>
        body {
          background-color: #121212;
          color: #00ff99;
          font-family: Arial, sans-serif;
          text-align: center;
          padding-top: 100px;
        }
        .box {
          border: 2px solid #00ff99;
          padding: 40px;
          border-radius: 10px;
          display: inline-block;
        }
        .id {
          color: #ccc;
          font-size: 0.9em;
        }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>✅ This Certificate is Verified</h1>
        <p class="id">Certificate ID: ${certId}</p>
      </div>
    </body>
    </html>
  `;
  res.send(html);
});

// Logout
app.get('/logout', (req, res) => {
  res.redirect('/');
});

// API Routes
app.use('/api/students', studentRoutes);

// Send Certificate
app.post('/send-certificate', async (req, res) => {
  const { studentId, certificateImage } = req.body;
  try {
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).send('Student not found');

    // Save the image temporarily
    const base64Data = certificateImage.replace(/^data:image\/png;base64,/, "");
    const filePath = `./tmp/certificate_${studentId}.png`;
    fs.writeFileSync(filePath, base64Data, 'base64');

    // Send email with nodemailer
    let transporter = nodemailer.createTransport({
      // Configure your SMTP here
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }

    });

    await transporter.sendMail({
      from: '"Certifizor" <your_email@gmail.com>',
      to: student.email,
      subject: 'Your Internship Certificate',
      text: 'Congratulations! Please find your certificate attached.',
      attachments: [
        {
          filename: 'certificate.png',
          path: filePath
        }
      ]
    });

    // Mark as printed
    student.printed = true;
    await student.save();

    // Remove temp file
    fs.unlinkSync(filePath);

    res.redirect('/home');
  } catch (err) {
    console.error('Failed to send certificate:', err);
    res.status(500).send('Failed to send certificate');
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
