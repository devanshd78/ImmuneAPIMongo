const express = require("express");
const {
    bookAppointment,
    getBookingById,
    createSchedule,
    deleteSchedule,
    getAvailableSchedule,
    getBookingByDay

} = require("../controllers/fullBodyCheckupContoller");

const router = express.Router();

router.post("/deleteSchedule", deleteSchedule);

router.post("/book", bookAppointment);
router.post("/schedule", createSchedule);
router.get("/getAvailable", getAvailableSchedule);

router.get("/getBookbyId", getBookingById);

router.get("/getBookingByDay", getBookingByDay);



module.exports = router;
