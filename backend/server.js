const express = require('express');
const connectDB = require('./config/db');
require('dotenv').config();
const studentRoutes = require('./routes/student.routes.js');
const Student = require('./models/student');

const path = require('path');
const app = express();
const PORT = 3000;


connectDB();


console.log('Connected to MongoDB');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files

app.get('/', (req, res) => {
  res.render('pages/login');
});

app.get('/signup', (req, res) => {
  res.render('pages/signup');
});

app.get('/home', async (req, res) => {
  try {
    const students = await Student.find();

    // Map DB fields to what home.ejs expects
    const mappedStudents = students.map(s => ({
      name: s.name,
      studentId: s.certId || s._id, // Use certId if available, else Mongo _id
      email: s.email,
      internshipCompleted: s.Offered || false, // Or use your own logic
      certificateSent: s.printed || false,
      _id: s._id // Needed for the form in "Send Certificates"
    }));

    res.render('pages/home', { students: mappedStudents });
  } catch (err) {
    res.status(500).send('Error loading students');
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use('/api/students', studentRoutes);
app.use(express.static(path.join(__dirname, 'public')));




// Dynamic certificate verification page
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


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
