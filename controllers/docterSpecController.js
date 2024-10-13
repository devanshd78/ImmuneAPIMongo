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

const AWS = require("aws-sdk"); // Make sure AWS SDK is imported

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

async function create(req, res) {
  try {
    await client.connect();
    const { name, description } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("DocterSpec");
    const countersCollection = db.collection("Counters");

    let validations = [];

    // Validate inputs
    if (!description)
      validations.push({
        key: "description",
        message: "Description is required",
      });
    if (!name) validations.push({ key: "name", message: "Name is required" });
    if (!req.file || !req.file.buffer)
      validations.push({ key: "img", message: "Image is required" });

    if (validations.length) {
      return res.status(400).json({ status: "error", validations });
    }

    // Check if specialization already exists
    let existing = await collection.findOne({ name });
    if (existing) {
      return res
        .status(400)
        .json({ status: "error", message: "Specialization already exists" });
    }

    // Increment the counter for new specialization ID
    const counter = await countersCollection.findOneAndUpdate(
      { _id: "specId" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );

    const newId = counter.seq;

    // Prepare S3 upload parameters
    const s3Params = {
      Bucket: "uploads.immplus.in", // Your S3 bucket name
      Key: `specialization/${newId}.png`, // File name for the image in S3
      Body: req.file.buffer,
      ContentType: req.file.mimetype, // Ensures correct MIME type
    };

    // Upload the image to S3
    const uploadResponse = await s3.upload(s3Params).promise();

    // Insert into the database with the S3 image URL
    const result = await collection.insertOne({
      _id: newId,
      name,
      description,
      img: uploadResponse.Location, // Use the S3 URL for the image
    });

    if (result.acknowledged === true) {
      return res
        .status(200)
        .json({ status: "success", message: "Specialization Saved" });
    } else {
      return res
        .status(400)
        .json({ status: "error", message: "Creation failed" });
    }
  } catch (error) {
    console.error("Error creating specialization:", error);
    return res.status(500).json({
      message: "Failed to create Specialization",
      error: error.message,
    });
  }
}

async function getAllCategories(req, res) {
  try {
    const db = client.db("ImmunePlus");
    const collection = db.collection("DocterSpec");

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

    const { id, name, description } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("DocterSpec");

    let updateFields = { name, description };
    let existing = await collection.findOne({ name });

    if (existing) {
      res
        .status(400)
        .json({ status: "error", message: "Specialization already exists" });
    } else {
      if (req.file && req.file.buffer) {
        const filePath = path.join(
          "uploads/specialization",
          req.file.originalname
        );
        if (!fs.existsSync("uploads/specialization")) {
          fs.mkdirSync("uploads/specialization", { recursive: true });
        }
        fs.writeFileSync(filePath, req.file.buffer);
        updateFields.img = filePath;
      }

      const result = await collection.updateOne(
        { _id: parseInt(id) },
        { $set: updateFields }
      );

      if (result.modifiedCount === 1) {
        res
          .status(200)
          .json({ status: "success", message: "Specialization Updated" });
      } else {
        res.status(400).json({ status: "error", message: "Update failed" });
      }
    }
  } catch (error) {
    res.status(500).json({
      message: "Failed to update Specialization",
      error: error.message,
    });
  }
}

// Controller function to delete a TypeOfTreatment
async function remove(req, res) {
  try {
    const { id } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("DocterSpec");

    const user = await collection.findOne({ _id: parseInt(id) });
    console.log(user);
    const result = await collection.deleteOne({ _id: parseInt(id) });
    console.log(result);
    if (result.deletedCount > 0) {
      res
        .status(200)
        .json({ status: "success", message: "Specialization Deleted" });
    } else {
      res.status(400).json({ status: "error", message: "Delete failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete Specialization", error: error });
  }
}

module.exports = {
  create,
  getAllCategories,
  upload,
  update,
  remove,
};
