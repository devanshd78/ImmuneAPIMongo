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

let isConnected = false;

async function connectToDatabase() {
  if (!isConnected) {
    try {
      await client.connect();
      isConnected = true;
      console.log("Connected to the database");
    } catch (err) {
      console.error("Failed to connect to the database", err);
      throw err;
    }
  }
}

// Multer configuration for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

async function create(req, res) {
  try {
    await connectToDatabase();
    const { name, description, date } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("Poster");
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
        .json({ status: "error", message: "Poster already exists" });
    } else {
      // Get and increment the counter for posterId
      const counter = await countersCollection.findOneAndUpdate(
        { _id: "adPosterId" },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after" }
      );

      const newId = counter.seq;
      const fileExtension = path.extname(req.file.originalname); // Get the file extension
      const fileName = `poster_${newId}_${uuidv4()}${fileExtension}`; // Unique file name
      const s3Params = {
        Bucket: "uploads.immplus.in", // Your S3 bucket name
        Key: `poster/${fileName}`, // File path in the bucket
        Body: req.file.buffer,
        ContentType: req.file.mimetype, // Ensure the file's MIME type is set correctly
      };

      // Upload to S3
      const s3Response = await s3.upload(s3Params).promise();
      const imageUrl = s3Response.Location; // S3 URL for the uploaded image

      // Insert the new poster into the database
      const result = await collection.insertOne({
        _id: newId,
        name,
        description,
        date,
        img: imageUrl, // Save the S3 image URL in the database
      });

      if (result.acknowledged) {
        return res
          .status(200)
          .json({ status: "success", message: "Poster Saved", imageUrl });
      } else {
        return res
          .status(400)
          .json({ status: "error", message: "Creation failed" });
      }
    }
  } catch (error) {
    console.error("Error creating poster:", error);
    return res
      .status(500)
      .json({ message: "Failed to create Poster", error: error.message });
  }
}

async function getAllPosters(req, res) {
  try {
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Poster");
    const categories = await collection.find().toArray();
    res.json(categories);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch Poster", error: error.message });
  }
}

async function update(req, res) {
  try {
    await connectToDatabase();
    const { id, name, description, date } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("Poster");

    let updateFields = { name, description, date };

    if (req.file && req.file.buffer) {
      // Prepare S3 upload parameters
      const fileName = `${id}.png`; // Use the ID for the image name
      const s3Params = {
        Bucket: "uploads.immplus.in", // Your S3 bucket name
        Key: `poster/${fileName}`, // Folder and file name in S3
        Body: req.file.buffer,
        ContentType: req.file.mimetype, // Ensure the file's MIME type is set correctly
      };

      // Upload to S3
      const s3Response = await s3.upload(s3Params).promise();
      updateFields.img = s3Response.Location; // Save the S3 URL for the image
    }

    const result = await collection.updateOne(
      { _id: parseInt(id) },
      { $set: updateFields }
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({ status: "success", message: "Poster Updated" });
    } else {
      res.status(400).json({ status: "error", message: "Update failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update Poster", error: error.message });
  }
}

async function remove(req, res) {
  try {
    await connectToDatabase();
    const { id } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("Poster");

    const result = await collection.deleteOne({ _id: parseInt(id) });

    if (result.deletedCount > 0) {
      res.status(200).json({ status: "success", message: "Poster Deleted" });
    } else {
      res.status(400).json({ status: "error", message: "Delete failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete Poster", error: error.message });
  }
}

module.exports = {
  create,
  getAllPosters,
  upload,
  update,
  remove,
};
