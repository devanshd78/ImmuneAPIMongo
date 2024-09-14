const express = require('express');
const { loginDelivery, registerDelivery, upload, updateDelivery, deleteDelivery, getAll,assignOrderToPartner,getAvailableOrders, getUserbyId, Dashboard, getOrderHistoryById } = require('../controllers/deliveryPartnerController');

const router = express.Router();

router.post('/login', loginDelivery);
router.post('/register', upload.fields([{ name: 'licensePhoto', maxCount: 1 }, { name: 'rcPhoto', maxCount: 1 },{ name: 'profilePic', maxCount: 1 }]), registerDelivery);
router.post('/update',  upload.fields([{ name: 'licensePhoto', maxCount: 1 }, { name: 'rcPhoto', maxCount: 1 },{ name: 'profilePic', maxCount: 1 }]), updateDelivery);
router.post('/delete', deleteDelivery);
router.get('/records', getAll);
router.get('/getAvailable', getAvailableOrders);
router.get('/getById', getUserbyId);
router.get('/dashboard', Dashboard);
router.post('/request', assignOrderToPartner);
router.get('/orderbyId', getOrderHistoryById);
// router.get('/getById', getUserbyId);

module.exports = router;
