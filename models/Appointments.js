const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const appointmentSchema = new Schema({
    _id: { type: String, required: true }, // or { type: Number, required: true }
    doctorId: { type: Number, ref: 'Doctor', required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    patientId: { type: Number, ref: 'Patient', required: true },
    // Add other fields if necessary
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
