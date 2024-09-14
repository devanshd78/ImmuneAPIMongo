const express = require('express');
const {
    create,
    getAllNotification,
    update,
    remove,
    getNotificationbyId
} = require('../../controllers/Notification/docterNotification');

const router = express.Router();

router.post('/create', create);
router.get('/records', getAllNotification);
router.post('/update', update);
router.post('/delete', remove);
router.get('/getById', getNotificationbyId);

module.exports = router;
