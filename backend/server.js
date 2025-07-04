const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const fs = require('fs');
const session = require('express-session');
const libre = require('libreoffice-convert'); 
const tmp = require('tmp'); 

const connectDB = require('./config/db');
const Student = require('./models/student');
const User = require('./models/User');
const studentRoutes = require('./routes/student.routes');

const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

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

// Session middleware (add after other middleware)
app.use(session({
  secret: 'your-secret-key', // Change this to a strong secret in production!
  resave: false,
  saveUninitialized: false
}));

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

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(password, salt);
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
app.get('/home', requireLogin, async (req, res) => {
  try {
    const students = await Student.find({ organization: req.session.organization });

    const today = new Date();
    const mappedStudents = students.map(s => {
      // Parse the 'to' date (format: DD/MM/YYYY)
      const [day, month, year] = s.to.split('/');
      const endDate = new Date(`${year}-${month}-${day}T23:59:59`);

      return {
        name: s.name,
        studentId: s.certId || s._id,
        email: s.email,
        from: s.from,
        to: s.to,
        internshipCompleted: today >= endDate,
        certificateSent: s.printed || false,
        _id: s._id,
        certId: s.certId, // <-- add this if not present
      };
    });

    res.render('pages/home', {
      pageTitle: 'Home',
      students: mappedStudents,
      organization: req.session.organization // <-- add this
    });
  } catch (err) {
    console.error('Failed to load students:', err);
    res.status(500).send('Error loading students');
  }
});

// Edit Template Page
const fsPromises = require('fs').promises;

app.get('/edit-template', async (req, res) => {
  try {
    const templatesDir = path.join(__dirname, 'public', 'templates');
    const files = await fsPromises.readdir(templatesDir);
    // Only include image files (png, jpg, jpeg, gif)
    const templates = files.filter(f => /\.(png|jpg|jpeg|gif)$/i.test(f));
    res.render('pages/edit-template', { pageTitle: 'Edit Template', templates });
  } catch (err) {
    console.error('Failed to load templates:', err);
    res.render('pages/edit-template', { pageTitle: 'Edit Template', templates: [] });
  }
});

// Manage Students Page
app.get('/manage', requireLogin, async (req, res) => {
  try {
    const students = await Student.find({ organization: req.session.organization });

    const mappedStudents = students.map(s => ({
      _id: s._id,
      name: s.name,
      studentId: s.certId || s._id,
      status: s.Offered ? 'Completed' : 'Pending',
      from: s.from,
      to: s.to,
      email: s.email,
      certId: s.certId, // <-- add this if not present
      
    }));

    res.render('pages/manage', {
      pageTitle: 'Manage Students',
      students: mappedStudents,
      organization: req.session.organization
    });
  } catch (err) {
    console.error('Error fetching students for manage page:', err);
    res.status(500).send('Failed to load student data');
  }
});
app.post('/manage', requireLogin, async (req, res) => {
  const { name, email, from, to, phone, college, internshipRole } = req.body;
  if (!name || !email || !from || !to || !phone || !college || !internshipRole) {
    return res.status(400).send('All fields are required');
  }
  try {
    const student = new Student({
      name,
      email,
      from,
      to,
      phone,
      college,
      internshipRole,
      organization: req.session.organization
    });
    await student.save();
    res.redirect('/manage');
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
  const { name, email, from, to, phone, college, internshipRole } = req.body;
  try {
    await Student.findByIdAndUpdate(req.params.id, { name, email, from, to, phone, college, internshipRole });
    res.redirect('/manage');
  } catch (err) {
    res.status(500).send('Failed to update student');
  }
});

// Send Offer Letter

app.post('/manage/offer/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).send('Student not found');

    const templatePath = path.join(__dirname, 'public', 'templates', 'offer.docx');
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    function getMonthDiff(from, to) {
    const [fromDay, fromMonth, fromYear] = from.split('/').map(Number);
    const [toDay, toMonth, toYear] = to.split('/').map(Number);
    const fromDate = new Date(fromYear, fromMonth - 1, fromDay);
    const toDate = new Date(toYear, toMonth - 1, toDay);
    let months = (toDate.getFullYear() - fromDate.getFullYear()) * 12 + (toDate.getMonth() - fromDate.getMonth());
    if (toDate.getDate() < fromDate.getDate()) months--;
    months = Math.max(months, 0) + 1;
    return months === 1 ? '1 month' : `${months} months`;
    }

    const duration = getMonthDiff(student.from, student.to);

    const data = {
      Name: student.name,
      StartDate: student.from,
      CollegeName: student.college || student.organization || '',
      PhoneNumber: student.phone,
      Email: student.email,
      InternshipRole: student.internshipRole || 'Developer Intern',
      InternshipDuration: duration
    };

    try {
      doc.render(data);
    } catch (error) {
      return res.status(500).send('Error filling offer letter template');
    }

    const buf = doc.getZip().generate({ type: 'nodebuffer' });

    // Save the DOCX temporarily
    const docxTmpPath = tmp.tmpNameSync({ postfix: '.docx' });
    fs.writeFileSync(docxTmpPath, buf);

    // Convert DOCX to PDF using ConvertAPI v2 JSON API
    const axios = require('axios');
    const pdfTmpPath = tmp.tmpNameSync({ postfix: '.pdf' });
    const offerFileName = `Offer_Letter_${student.name.replace(/\s+/g, '_')}.pdf`;
    let pdfBuffer;
    try {
      const convertApiToken = process.env.CONVERTAPI_TOKEN;
      if (!convertApiToken) {
        throw new Error('ConvertAPI Bearer token not set in environment variables.');
      }
      // Read DOCX and encode as base64
      const docxData = fs.readFileSync(docxTmpPath);
      const docxBase64 = docxData.toString('base64');
      const payload = {
        Parameters: [
          {
            Name: 'File',
            FileValue: {
              Name: 'offer.docx',
              Data: docxBase64
            }
          },
          {
            Name: 'StoreFile',
            Value: true
          }
        ]
      };
      const response = await axios.post(
        'https://v2.convertapi.com/convert/doc/to/pdf',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${convertApiToken}`,
            'Content-Type': 'application/json'
          },
          responseType: 'json'
        }
      );
      const fileUrl = response.data.Files[0].Url;
      const pdfRes = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      pdfBuffer = Buffer.from(pdfRes.data);
      fs.writeFileSync(pdfTmpPath, pdfBuffer);
    } catch (err) {
      console.error('PDF conversion via ConvertAPI failed:', err);
      fs.unlinkSync(docxTmpPath);
      return res.status(500).send('PDF conversion failed. Check your ConvertAPI token and internet connection.');
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
          from: 'Certifizor <' + process.env.EMAIL_USER + '>',
          to: student.email,
          subject: 'Your Internship Offer Letter – ' + (student.organization || 'Certifizor'),
          text: `Dear ${student.name},

        Congratulations!

        We are thrilled to offer you the position of *${student.internshipRole}* at ${student.organization || 'our organization'} for the internship period from ${student.from} to ${student.to}. This opportunity reflects our confidence in your potential and skills.

        Please find your official internship offer letter attached with this email.

        If you have any questions or need further assistance, feel free to reach out.

        Welcome aboard!

        Best regards,  
        ${student.organization || 'Certifizor Team'}`
        ,
          attachments: [
            {
              filename: offerFileName,
              path: pdfTmpPath
            }
          ]
        };


    await transporter.sendMail(mailOptions);

    student.Offered = true;
    await student.save();

    fs.unlinkSync(docxTmpPath);
    fs.unlinkSync(pdfTmpPath);

    res.redirect('/manage');
  } catch (err) {
    console.error('Failed to send offer letter:', err);
    res.status(500).send('Failed to send offer letter');
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
app.get('/verify/:id', async (req, res) => {
  const certId = req.params.id;
  try {
    const student = await Student.findOne({ certId }) || await Student.findById(certId);
    if (!student) {
      return res.status(404).send('Certificate not Verified');
    }
    // Redirect to the static HTML with query params
    const query = new URLSearchParams({
      certId: student.certId || student._id,
      name: student.name,
      to: student.to
    }).toString();
    res.redirect(`/verify-certificate.html?${query}`);
  } catch (err) {
    res.status(500).send('Error verifying certificate');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// API Routes
app.use('/api/students', studentRoutes);

// Send Certificate
app.post('/send-certificate', async (req, res) => {
  const { studentId, certificateImage } = req.body;
  try {
    if (!studentId || !certificateImage) {
      return res.status(400).send('Student ID and certificate image are required');
    }

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).send('Student not found');

    // Prepare image buffer directly from base64
    const base64Match = certificateImage.match(/^data:image\/png;base64,(.+)$/);
    if (!base64Match) {
      return res.status(400).send('Invalid certificate image format');
    }
    const base64Data = base64Match[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Send email with nodemailer
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: 'Certifizor <' + process.env.EMAIL_USER + '>',
      to: student.email,
      subject: 'Internship Certificate from Certifizor',
      text: `Dear ${student.name},

Congratulations on successfully completing your internship at ${student.organization}!

Please find your internship certificate attached to this email.

Best regards,
Certifizor Team`,
      attachments: [
        {
          filename: 'certificate.png',
          content: imageBuffer,
          contentType: 'image/png'
        }
      ]
    });

    // Mark as printed
    student.printed = true;
    await student.save();

    res.redirect('/home');
  } catch (err) {
    console.error('Failed to send certificate:', err);
    res.status(500).send('Failed to send certificate');
  }
});

// Login Handler
app.post('/pages/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.send('Invalid email or password');
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.send('Invalid email or password');
  }
  // Store organization in session
  req.session.organization = user.Organization;
  req.session.userId = user._id;
  res.redirect('/home');
});

// Signup Handler
app.post('/pages/signup', async (req, res) => {
  const { Organization, email, password } = req.body;
  if (!Organization || !email || !password) {
    return res.send('All fields are required');
  }
  const existing = await User.findOne({ email });
  if (existing) return res.send('User already exists');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const user = new User({ Organization, email, password: hashedPassword });
  await user.save();
  res.redirect('/pages/login');
});

// Middleware to require login
function requireLogin(req, res, next) {
  if (!req.session.organization) {
    return res.redirect('/pages/login');
  }
  next();
}

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
