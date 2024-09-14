const mongoose = require('mongoose');

const ageGroupSchema = new mongoose.Schema({
    value: {
        type: Number,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    }
});

const AgeGroup = mongoose.model('AgeGroup', ageGroupSchema);

module.exports = {AgeGroup};
