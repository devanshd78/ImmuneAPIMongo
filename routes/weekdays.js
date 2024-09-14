const express = require('express');
const {
    create,
    getAll,
    update, remove
} = require('../controllers/weekdaysController');

const router = express.Router();

router.post('/create', create);
router.get('/records', getAll);
router.post('/update', update);
router.post('/delete', remove);

module.exports = router;
