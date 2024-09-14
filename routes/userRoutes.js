const express = require('express');
const { loginUser, registerUser, updateUser, deleteUser,getAll } = require('../controllers/usersController');

const router = express.Router();

router.post('/login', loginUser);
router.post('/register', registerUser);
router.post('/update', updateUser);
router.post('/delete', deleteUser);
router.get('/records', getAll);

module.exports = router;
