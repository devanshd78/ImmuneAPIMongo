const mongoose = require('mongoose');

const doctorAvailabilitySchema = new mongoose.Schema({
    doctorId: Number,
    date: Date,
    weekday: String,
    time: String,
    availableSlots: Number,
    bookings: Number
});

const DoctorAvailability = mongoose.model('DoctorAvailability', doctorAvailabilitySchema);

module.exports = DoctorAvailability;
