const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');

const connectDB = require('./config/db');
const Student = require('./models/student');
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Global layout variable
app.use((req, res, next) => {
  res.locals.pageTitle = 'Certifizor';
  next();
});

// Login Page
app.get('/pages/login', (req, res) => {
  res.render('pages/login', { pageTitle: 'Login', layout: false });
});

// Signup Page
app.get('/pages/signup', (req, res) => {
  res.render('pages/signup', { pageTitle: 'Signup', layout: false });
});

// Redirect root to login
app.get('/', (req, res) => {
  res.redirect('/pages/login');
});

// Home Page
app.get('/home', async (req, res) => {
  try {
    const students = await Student.find();

    const mappedStudents = students.map(s => ({
      name: s.name,
      studentId: s.certId || s._id,
      email: s.email,
      internshipCompleted: s.Offered || false,
      certificateSent: s.printed || false,
      _id: s._id,
    }));

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

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
