const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true
    },
    address: {
        type: String
    },
    fullName: {
        type: String,
        required: true
    },
    ageGroup: {
        type: Number,
        enum: [1, 2, 3, 4], // Assuming age groups 1, 2, 3, 4
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true // Ensuring emails are unique
    },
    gender: {
        type: Number,
        enum: [0, 1], // Assuming 0 for male and 1 for female
        required: true
    },
    state: {
        type: String
    },
    pincode: {
        type: String
    },
    phoneNumber: {
        type: String,
        required: true
    },
    previousHistory: {
        type: [String] // Assuming an array of strings for previous history
    },
    userId: {
        type: String,
        required: true,
        unique: true // Ensuring userIds are unique
    }
});

const User = mongoose.model('User', userSchema);

module.exports = { User };
