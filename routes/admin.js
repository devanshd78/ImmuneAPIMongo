const express = require("express");
const {
  changeDocter,
  changePharmacy,
  changeDeliveryPartner,
  login,
  getPendingRequests,
  emptyCollection,
} = require("../controllers/adminController");

const router = express.Router();

router.post("/changeDocterStatus", changeDocter);
router.post("/changePharmaStatus", changePharmacy);
router.post("/changeDelParStatus", changeDeliveryPartner);
router.post("/login", login);
router.get("/getPending", getPendingRequests);
router.get("/deletAll", emptyCollection);

module.exports = router;
