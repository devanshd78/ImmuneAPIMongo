const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { MongoClient, ServerApiVersion } = require("mongodb");

const client = new MongoClient(process.env.UU, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Multer configuration for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

async function create(req, res) {
  try {
    const {
      img,
      name,
      manufacturers,
      category,
      sub_category,
      Packaging,
      Package,
      Quantity,
      Product_Form,
      MRP,
      prescription_required,
      primary_use,
      description,
      salt_synonmys,
      storage,
      introduction,
      use_of,
      benefits,
      side_effect,
      how_to_use,
      how_works,
      safety_advise,
      if_miss,
      ingredients,
      country_of_origin,
    } = req.body;

    const db = client.db("ImmunePlus");
    const collection = db.collection("OTC");
    const countersCollection = db.collection("Counters");

    let existing = await collection.findOne({ name });

    if (existing) {
      return res
        .status(400)
        .json({ status: "error", message: "Product already exists" });
    } else {
      const counter = await countersCollection.findOneAndUpdate(
        { _id: "productId" },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after" }
      );
      const newId = counter.seq;

      const parsedPrescription = prescription_required === "true";

      // Insert the new product into the database
      const result = await collection.insertOne({
        _id: newId,
        img: img || "default_image_path_or_value",
        name,
        manufacturers,
        salt_synonmys, // Ensure this variable is properly defined in req.body
        introduction,
        benefits,
        description,
        how_to_use,
        safety_advise,
        if_miss,
        Packaging,
        Package,
        Quantity: parseFloat(Quantity) || 0,
        Product_Form,
        MRP: parseFloat(MRP) || 0,
        prescription_required: parsedPrescription,
        primary_use,
        storage,
        use_of,
        side_effect,
        how_works,
        ingredients,
        country_of_origin,
      });

      if (result.acknowledged) {
        return res
          .status(200)
          .json({ status: "success", message: "Product Saved" });
      } else {
        return res
          .status(400)
          .json({ status: "error", message: "Creation failed" });
      }
    }
  } catch (error) {
    console.error("Failed to create product:", error.message);
    res
      .status(500)
      .json({ message: "Failed to create product", error: error.message });
  }
}

async function getAllProducts(req, res) {
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("OTC");

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const searchQuery = req.query.searchQuery || "";

    const skip = (page - 1) * limit;

    const searchRegex = new RegExp(searchQuery, "i");

    const products = await collection
      .find({
        name: searchRegex,
      })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalProducts = await collection.countDocuments({
      name: searchRegex,
    });

    res.json({
      totalProducts,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      products,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch products", error: error.message });
  } finally {
    //await client.close();
  }
}

async function update(req, res) {
  try {
    await client.connect();

    const { id, name, description, price, pieces, dose, category } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("OTC");

    let existing = await collection.findOne({ name });

    if (existing) {
      return res
        .status(400)
        .json({ status: "error", message: "Product already exists" });
    }

    let updateFields = { name, description, price };

    if (typeof pieces === "string") {
      updateFields.pieces = pieces
        .split(",")
        .map((item) => parseFloat(item.trim()));
    } else if (Array.isArray(pieces)) {
      updateFields.pieces = pieces.map((item) => parseFloat(item));
    }

    if (typeof dose === "string") {
      updateFields.dose = dose
        .split(",")
        .map((item) => parseFloat(item.trim()));
    } else if (Array.isArray(dose)) {
      updateFields.dose = dose.map((item) => parseFloat(item));
    }

    if (typeof category === "string") {
      updateFields.category = category
        .split(",")
        .map((item) => parseFloat(item.trim()));
    } else if (Array.isArray(category)) {
      updateFields.category = category.map((item) => parseFloat(item));
    }

    if (req.file && req.file.buffer) {
      const filePath = path.join("uploads/otc", `${id}`);
      if (!fs.existsSync("uploads/otc")) {
        fs.mkdirSync("uploads/otc", { recursive: true });
      }
      fs.writeFileSync(filePath, req.file.buffer);
      updateFields.img = filePath;
    }

    const result = await collection.updateOne(
      { _id: parseInt(id) },
      { $set: updateFields }
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({ status: "success", message: "Product Updated" });
    } else {
      res.status(400).json({ status: "error", message: "Update failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update Product", error: error.message });
  } finally {
    //await client.close();
  }
}

// Controller function to delete a TypeOfTreatment
async function remove(req, res) {
  try {
    const { id } = req.body;
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("OTC");

    const user = await collection.findOne({ _id: parseInt(id) });
    console.log(user);
    const result = await collection.deleteOne({ _id: parseInt(id) });
    console.log(result);
    if (result.deletedCount > 0) {
      res.status(200).json({ status: "success", message: "Product Deleted" });
    } else {
      res.status(400).json({ status: "error", message: "Delete failed" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete Product", error: error });
  }
}

async function getProductById(req, res) {
  const { id } = req.query;

  if (!id) {
    res
      .status(400)
      .json({ status: "error", message: "Product ID is required" });
    return;
  }
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("OTC");
    const product = await collection.find({ _id: parseInt(id) }).toArray();
    if (product.length === 0) {
      res.status(404).json({ status: "error", message: "Product not found" });
    } else {
      res.json(product);
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch Product", error: error.message });
  }
}

async function getProductByCategory(req, res) {
  const { category, page = 1, limit = 10 } = req.query;
  console.log(category);
  if (!category) {
    res.status(400).json({ status: "error", message: "Category is required" });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("OTC");

    // Calculate the number of documents to skip
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch the products with pagination
    const products = await collection
      .find({ category })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    // Count the total number of products in the category
    const totalProducts = await collection.countDocuments({ category });

    // If no products found, return a 404 error
    if (products.length === 0) {
      res.status(404).json({ status: "error", message: "Products not found" });
    } else {
      // Return paginated results with metadata
      res.json({
        status: "success",
        totalPages: Math.ceil(totalProducts / limit),
        currentPage: parseInt(page),
        totalProducts,
        products,
      });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch products",
      error: error.message,
    });
  }
}

module.exports = {
  create,
  getAllProducts,
  upload,
  update,
  remove,
  getProductById,
  getProductByCategory,
};
