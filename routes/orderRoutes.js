const express = require('express');
const { placeOrder, getOrderbyId,receivePharmacyResponse, changeOrderStatus,getAll,getAvailableOrders } = require('../controllers/orderController');

const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.post('/create', upload.array('img', 10), placeOrder);
router.get('/id', getOrderbyId);
router.post('/request', receivePharmacyResponse);
router.post('/status', changeOrderStatus);
router.get('/records', getAll);
router.get('/getAvailable', getAvailableOrders);
module.exports = router;


// router.post('/create', async (req, res) => {
//     try {
//         const order = await placeOrder(req, res);

//         // Emit a socket event to notify all connected clients about the new order
//         global.io.emit('newOrder', order);
//     } catch (error) {
//         res.status(500).json({ status: 'error', message: 'Order placement failed', reason: error.message });
//     }
// });
