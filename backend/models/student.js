const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  email:{
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  printed: {
    type: Boolean,
    default: false
  },
  Offered:{
    type:Boolean,
    default: false
  },
  certId: {
    type: String,
    unique: true,
    sparse: true // Allows null values until generated
  }
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema, 'Students');
