const { MongoClient, ServerApiVersion } = require("mongodb");

const path = require("path");
const multer = require("multer");
const fs = require("fs");
const { error } = require("console");
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
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Controller function to create a new TypeOfTreatment
async function create(req, res) {
  try {
    await client.connect();
    const { name, description } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("TypeOfTreatment");
    const countersCollection = db.collection("Counters");

    let validations = [];

    if (!description)
      validations.push({
        key: "description",
        message: "Description is required",
      });
    if (!name) validations.push({ key: "name", message: "Name is required" });
    if (!req.file || !req.file.buffer)
      validations.push({ key: "img", message: "Image is required" });

    let existing = await collection.findOne({ name });

    if (validations.length) {
      return res.status(400).json({ status: "error", validations });
    }

    if (existing) {
      return res
        .status(400)
        .json({ status: "error", message: "Type Of Treatment already exists" });
    } else {
      const counter = await countersCollection.findOneAndUpdate(
        { _id: "typeOfTreatmentId" },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after" }
      );
      const newId = counter.seq;

      // Prepare S3 upload parameters
      const fileExtension = path.extname(req.file.originalname); // Get the file extension
      const fileName = `treatment_${newId}_${uuidv4()}${fileExtension}`; // Unique file name
      const s3Params = {
        Bucket: "uploads.immplus.in", // Your S3 bucket name
        Key: `treatment/${fileName}`, // File path in the bucket
        Body: req.file.buffer,
        ContentType: req.file.mimetype, // Ensure the file's MIME type is set correctly
      };

      // Upload to S3
      const s3Response = await s3.upload(s3Params).promise();
      const imageUrl = s3Response.Location; // S3 URL for the uploaded image

      // Insert the new TypeOfTreatment into the database
      const result = await collection.insertOne({
        _id: newId,
        name,
        description,
        img: imageUrl, // Save the S3 image URL in the database
      });

      if (result.acknowledged) {
        return res.status(200).json({
          status: "success",
          message: "TypeOfTreatment Saved",
          imageUrl,
        });
      } else {
        return res
          .status(400)
          .json({ status: "error", message: "Registration failed" });
      }
    }
  } catch (error) {
    console.error("Error creating TypeOfTreatment:", error);
    return res.status(500).json({
      message: "Failed to create TypeOfTreatment",
      error: error.message,
    });
  }
}

// Controller function to get all TypeOfTreatments
async function getAll(req, res) {
  try {
    const db = client.db("ImmunePlus");
    const collection = db.collection("TypeOfTreatment");

    const TypeOfTreatment = await collection.find().toArray();
    res.json(TypeOfTreatment);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch TypeOfTreatments",
      error: error.message,
    });
  }
}

async function update(req, res) {
  try {
    // Ensure the client is connected
    await client.connect();

    const { id, name, description } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("TypeOfTreatment");

    let updateFields = { name, description };

    let existing = await collection.findOne({ name });

    if (existing) {
      return res
        .status(400)
        .json({ status: "error", message: "Type Of Treatment already exists" });
    } else {
      // Check if there is an image file to upload
      if (req.file && req.file.buffer) {
        // Prepare S3 upload parameters
        const fileExtension = path.extname(req.file.originalname); // Get the file extension
        const fileName = `treatment_${id}_${uuidv4()}${fileExtension}`; // Unique file name
        const s3Params = {
          Bucket: "uploads.immplus.in", // Your S3 bucket name
          Key: `treatment/${fileName}`, // File path in the bucket
          Body: req.file.buffer,
          ContentType: req.file.mimetype, // Ensure the file's MIME type is set correctly
        };

        // Upload to S3
        const uploadResponse = await s3.upload(s3Params).promise();
        updateFields.img = uploadResponse.Location; // Get the URL of the uploaded image
      }

      const result = await collection.updateOne(
        { _id: parseInt(id) },
        { $set: updateFields }
      );

      if (result.modifiedCount === 1) {
        return res
          .status(200)
          .json({ status: "success", message: "TypeOfTreatment Updated" });
      } else {
        return res
          .status(400)
          .json({ status: "error", message: "Update failed" });
      }
    }
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update TypeOfTreatment",
      error: error.message,
    });
  }
}

// Controller function to delete a TypeOfTreatment
async function remove(req, res) {
  try {
    const { id } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("TypeOfTreatment");

    const user = await collection.findOne({ _id: parseInt(id) });
    console.log(user);
    const result = await collection.deleteOne({ _id: parseInt(id) });
    console.log(result);
    if (result.deletedCount > 0) {
      res
        .status(200)
        .json({ status: "success", message: "TypeOfTreatment Deleted" });
    } else {
      res.status(400).json({ status: "error", message: "Delete failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete TypeOfTreatment", error: error });
  }
}

module.exports = {
  create,
  getAll,
  upload,
  update,
  remove,
};
