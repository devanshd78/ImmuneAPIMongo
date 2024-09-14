const express = require('express');
const { create, getAllCategories, upload,update,remove } = require('../controllers/subCategoryController');

const router = express.Router();

router.post('/create', upload.single('img'), create);
router.get('/records', getAllCategories);
router.post('/update',upload.single('img'), update);
router.post('/delete', remove);

module.exports = router;
