const express = require("express");
const {
  create,
  getAll,
  remove,
  calculatePrice,
  getCouponsByUser,
} = require("../controllers/couponsController");

const router = express.Router();

router.post("/create", create);
router.get("/getAll", getAll);
router.post("/delete", remove);
router.post("/calc", calculatePrice);
router.post("/getCoupon", getCouponsByUser);

module.exports = router;
