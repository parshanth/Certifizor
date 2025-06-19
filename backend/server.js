const express = require('express');
const connectDB = require('./config/db');
require('dotenv').config();

const path = require('path');
const app = express();
const PORT = 3000;
connectDB();
console.log('Connected to MongoDB');
// Serve static files
app.use(express.static('public'));

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
