const express = require("express");
const {
  loginDoctor,
  registerDoctor,
  updateDoctor,
  updateTotalSlots,
  upload,
  Dashboard,
  getSchedulebyIdDetails,
  deleteSchedule,
  deleteDoctor,
  getAll,
  getAllAvailableDocter,
  getDocterbyId,
  bookAppointment,
  createSchedule,
  filterSchedules,
  getTopRatedDoctors,
  getSchedulebyId,
  getAppointmentbyId,
  getBookingById,
  getScheduleByScheduleId,
  searchDoctors,
  searchFilterDoctors
} = require("../controllers/doctersController");

const router = express.Router();

router.post("/login", loginDoctor);
router.post("/register", upload.single("img"), registerDoctor);
router.post("/update", upload.single("img"), updateDoctor);
router.post("/delete", deleteDoctor);
router.get("/records", getAll);
router.get("/getAllAvailable", getAllAvailableDocter);
router.post("/updateSchedule", updateTotalSlots);
router.post("/deleteSchedule", deleteSchedule);
router.get("/getById", getDocterbyId);
router.post("/book", bookAppointment);
router.post("/schedule", createSchedule);
router.get("/filterSchedules", filterSchedules);
router.get("/topRated", getTopRatedDoctors);
router.get("/scheduleById", getSchedulebyId);
router.get("/getscheduleById", getScheduleByScheduleId);
router.get("/appointmentById", getAppointmentbyId);
router.get("/dashboard", Dashboard);
router.get("/getBookbyId", getBookingById);
router.get("/scheduleByIdDetails", getSchedulebyIdDetails);
router.post("/search", searchDoctors);
router.post("/searchFilter", searchFilterDoctors);

module.exports = router;
