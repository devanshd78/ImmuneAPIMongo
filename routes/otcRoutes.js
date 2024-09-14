const express = require("express");
const {
  create,
  getAllProducts,
  upload,
  update,
  remove,
  getProductById,
  getProductByCategory,
} = require("../controllers/otcProductController");

const router = express.Router();
console.log("hit");
router.post("/create", create);
router.get("/records", getAllProducts);
router.post("/update", upload.single("img"), update);
router.post("/delete", remove);
router.get("/getById", getProductById);
router.get("/getByCategory", getProductByCategory);

module.exports = router;
