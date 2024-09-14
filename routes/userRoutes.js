const express = require("express");
const {
  loginUser,
  registerUser,
  updateUser,
  deleteUser,
  getAll,
  getUserbyId,
  getUserAppointment,
  dummyLoginUser,
} = require("../controllers/usersController");

const router = express.Router();

router.post("/login", loginUser);
router.post("/register", registerUser);
router.post("/update", updateUser);
router.post("/delete", deleteUser);
router.get("/records", getAll);
router.get("/getById", getUserbyId);
router.get("/appointment", getUserAppointment);
router.post("/dummylogin", dummyLoginUser);

module.exports = router;
