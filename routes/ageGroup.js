const express = require('express');
const {
    createAgeGroup,
    getAllAgeGroups,
    update, remove
} = require('../controllers/ageGroupController');

const router = express.Router();


router.post('/create', createAgeGroup);
router.get('/records', getAllAgeGroups);
router.post('/update', update);
router.post('/delete', remove);

module.exports = router;
