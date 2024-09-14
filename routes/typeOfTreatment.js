const express = require('express');
const {
    create,
    getAll,
    upload,
    update,
    remove
} = require('../controllers/treatmentController');

const router = express.Router();

router.post('/create', upload.single('img'), create);
router.get('/records', getAll);
router.post('/update',upload.single('img'), update);
router.post('/delete', remove);

module.exports = router;
