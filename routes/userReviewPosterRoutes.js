const express = require('express');
const { create, getAllPosters, upload,update,remove } = require('../controllers/userReviewPosterController');

const router = express.Router();

router.post('/create', upload.single('img'), create);
router.get('/records', getAllPosters);
router.post('/update',upload.single('img'), update);
router.post('/delete', remove);

module.exports = router;
