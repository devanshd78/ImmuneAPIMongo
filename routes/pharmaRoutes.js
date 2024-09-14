const express = require('express');
const { loginUser, registerUser, updateUser, deleteUser,getAll, upload,Dashboard,getOngoingOrder, getOrderbyId,getPharmabyId } = require('../controllers/pharmaController');

const router = express.Router();

router.post('/login', loginUser);
router.post('/register', upload.single('licenseImg'), registerUser);
router.post('/update', upload.single('licenseImg'), updateUser);
router.post('/delete', deleteUser);
router.get('/records', getAll);
router.get('/dashboard', Dashboard);
router.get('/ongoingOrder', getOngoingOrder);
router.get('/getOrderById', getOrderbyId);
router.get('/getPharmaById', getPharmabyId);

module.exports = router;
