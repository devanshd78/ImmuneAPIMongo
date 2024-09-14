const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  pieces: {
    type: [Number],
    required: true
  },
  dose: {
    type: [Number],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Order = mongoose.model('Order', OrderSchema);

module.exports = Order;

