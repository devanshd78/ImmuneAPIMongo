const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    doctorId: { type: Number, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    patientId: { type: Number, required: true },
    status: { type: String, default: 'booked' } // Add more fields as necessary
});

module.exports = mongoose.model('Appointment', appointmentSchema);
