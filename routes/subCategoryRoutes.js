const express = require("express");
const {
  create,
  getAllCategories,
  upload,
  update,
  remove,
  getSubCategoryByCategory
} = require("../controllers/subCategoryController");

const router = express.Router();

router.post("/create", upload.single("img"), create);
router.get("/records", getAllCategories);
router.post("/update", upload.single("img"), update);
router.post("/delete", remove);
router.get("/getByCategory", getSubCategoryByCategory);

module.exports = router;
