const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    _id: Number,
    name: String,
    description: String,
    price: Number,
    pieces: String,
    dose: String
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
