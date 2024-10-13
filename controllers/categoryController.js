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
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Multer configuration for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

async function create(req, res) {
  try {
    await client.connect();
    const { name } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("Category");
    const countersCollection = db.collection("Counters");

    let validations = [];

    if (!name) validations.push({ key: "name", message: "Name is required" });
    if (!req.file || !req.file.buffer)
      validations.push({ key: "img", message: "Image is required" });

    let existing = await collection.findOne({ name });

    if (validations.length) {
      return res
        .status(400)
        .json({ status: "error", validations: validations });
    }

    if (existing) {
      return res
        .status(400)
        .json({ status: "error", message: "Category already exists" });
    } else {
      const counter = await countersCollection.findOneAndUpdate(
        { _id: "categoryId" },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after" }
      );
      const newId = counter.seq; // Use counter.value.seq instead of just counter.seq

      // Prepare S3 upload parameters
      const fileExtension = path.extname(req.file.originalname); // Get the file extension
      const fileName = `category_${newId}_${uuidv4()}${fileExtension}`; // Unique file name
      const s3Params = {
        Bucket: "uploads.immplus.in", // Your S3 bucket name
        Key: `category/${fileName}`, // File path in the bucket
        Body: req.file.buffer,
        ContentType: req.file.mimetype, // Ensure the file's MIME type is set correctly
      };

      // Upload to S3
      const s3Response = await s3.upload(s3Params).promise();
      const imageUrl = s3Response.Location; // S3 URL for the uploaded image

      // Insert the new category into the database
      const result = await collection.insertOne({
        _id: newId,
        name,
        img: imageUrl, // Save the S3 image URL in the database
      });

      if (result.acknowledged === true) {
        return res
          .status(200)
          .json({ status: "success", message: "Category Saved", imageUrl });
      } else {
        return res
          .status(400)
          .json({ status: "error", message: "Creation failed" });
      }
    }
  } catch (error) {
    console.error("Error creating category:", error);
    return res
      .status(500)
      .json({ message: "Failed to create Category", error: error.message });
  }
}

async function getAllCategories(req, res) {
  try {
    const db = client.db("ImmunePlus");
    const collection = db.collection("Category");

    const categories = await collection.find().toArray();
    res.json(categories);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch categories", error: error.message });
  }
}

async function update(req, res) {
  try {
    // Ensure the client is connected

    const { id, name } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("Category");

    let updateFields = { name };
    let existing = await collection.findOne({ name });

    if (existing) {
      return res
        .status(400)
        .json({ status: "error", message: "Category already exists" });
    } else {
      if (req.file && req.file.buffer) {
        // Prepare S3 upload parameters
        const fileExtension = path.extname(req.file.originalname); // Get the file extension
        const fileName = `category_${id}_${uuidv4()}${fileExtension}`; // Unique file name
        const s3Params = {
          Bucket: "uploads.immplus.in", // Your S3 bucket name
          Key: `category/${fileName}`, // File path in the bucket
          Body: req.file.buffer,
          ContentType: req.file.mimetype, // Ensure the file's MIME type is set correctly
        };

        // Upload to S3
        const s3Response = await s3.upload(s3Params).promise();
        const imageUrl = s3Response.Location; // S3 URL for the uploaded image

        updateFields.img = imageUrl; // Save the S3 image URL in the update fields
      }

      const result = await collection.updateOne(
        { _id: parseInt(id) },
        { $set: updateFields }
      );

      if (result.modifiedCount === 1) {
        return res
          .status(200)
          .json({ status: "success", message: "Category Updated" });
      } else {
        return res
          .status(400)
          .json({ status: "error", message: "Update failed" });
      }
    }
  } catch (error) {
    console.error("Error updating category:", error);
    return res
      .status(500)
      .json({ message: "Failed to update Category", error: error.message });
  }
}

// Controller function to delete a TypeOfTreatment
async function remove(req, res) {
  try {
    const { id } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("Category");

    const user = await collection.findOne({ _id: parseInt(id) });
    console.log(user);
    const result = await collection.deleteOne({ _id: parseInt(id) });
    console.log(result);
    if (result.deletedCount > 0) {
      res.status(200).json({ status: "success", message: "Category Deleted" });
    } else {
      res.status(400).json({ status: "error", message: "Delete failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete Category", error: error });
  }
}

module.exports = {
  create,
  getAllCategories,
  upload,
  update,
  remove,
};
