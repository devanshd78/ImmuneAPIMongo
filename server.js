const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const orderRoutes = require('./routes/orderRoutes');
const pharmacyRoutes = require('./routes/pharmaRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

mongoose.connect('mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/ImmunePlus', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(bodyParser.json());
app.use(express.static('public'));

app.use('/orders', orderRoutes);
app.use('/pharmacies', pharmacyRoutes);

io.on('connection', (socket) => {
  console.log('New client connected');
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

global.io = io;

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
