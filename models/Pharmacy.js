const mongoose = require('mongoose');

const PharmacySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  licenseNo: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  licenseImg: {
    type: String,
    required: true
  }
});

const Pharmacy = mongoose.model('Pharmacy', PharmacySchema);

module.exports = Pharmacy;
