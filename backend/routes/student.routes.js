const express = require('express');
const router = express.Router();
const Student = require('../models/student');

// Add new student route
router.post('/add', async (req, res) => {
  const { name, from, to, email, phone } = req.body;

  if (!name || !from || !to || !email || !phone) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const existing = await Student.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(409).json({ error: "Email or phone already exists" });
    }

    const student = new Student({ name, from, to, email, phone });
    await student.save();
    console.log("Saved student:102", student);
    res.status(201).json({ message: "Student added successfully", student });
  } catch (err) {
    res.status(500).json({ error: "Failed to add student", details: err.message });
  }
});

// GET /api/students
router.get('/see', async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 }); // newest first
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch students", details: err.message });
  }
});


module.exports = router;
