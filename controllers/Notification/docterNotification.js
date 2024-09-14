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

async function create(req, res) {
  try {
    await client.connect();
    const { userId, message, type } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("docterNotification");
    const countersCollection = db.collection("Counters");

    const validations = [];
    if (!userId)
      validations.push({ key: "userId", message: "User ID is required" });
    if (!message)
      validations.push({ key: "message", message: "Message is required" });
    if (!type) validations.push({ key: "type", message: "Type is required" });

    if (validations.length) {
      res.status(400).json({ status: "error", validations: validations });
      return;
    }

    // Get and increment the counter for TypeOfTreatment
    const counter = await countersCollection.findOneAndUpdate(
      { _id: "docterNotificationId" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    const newId = counter.seq;
    const dateInIST = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });
    const notification = {
      userId: parseInt(userId),
      userType: 3,
      message,
      date: dateInIST,
      read: false,
      type,
      status: "pending",
      _id: newId,
    };

    const result = await collection.insertOne(notification);

    if (result.acknowledged === true) {
      return res
        .status(200)
        .json({ status: "success", message: "Notification Saved" });
    } else {
      res.status(400).json({ status: "error", message: "Creation failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create Notification", error: error.message });
  }
}

async function getAllNotification(req, res) {
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("docterNotification");

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

    const { userId, message, type, id } = req.body;
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("docterNotification");

    let updateFields = { userId, message, type };

    const result = await collection.updateOne(
      { _id: parseInt(id) },
      { $set: updateFields }
    );

    if (result.modifiedCount === 1) {
      res
        .status(200)
        .json({ status: "success", message: "Notification Updated" });
    } else {
      res.status(400).json({ status: "error", message: "Update failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update Notification", error: error.message });
  }
}

// Controller function to delete a TypeOfTreatment
async function remove(req, res) {
  try {
    const { id } = req.body;
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("docterNotification");

    const result = await collection.deleteOne({ _id: parseInt(id) });

    if (result.deletedCount > 0) {
      res
        .status(200)
        .json({ status: "success", message: "Notification Deleted" });
    } else {
      res.status(400).json({ status: "error", message: "Delete failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete Notification", error: error });
  }
}

async function getNotificationbyId(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "User ID is required" });
    return;
  }
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("docterNotification");
    const noti = await collection.find({ userId: parseInt(id) }).toArray();
    res.json(noti);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch notification", error: error.message });
  }
}

async function sendDoctorNotification(userId, bookingId, type) {
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const notificationsCollection = db.collection("docterNotification");
    const countersCollection = db.collection("Counters");
    const bookingCollection = db.collection("appointments");

    // Fetch booking data
    const booking = await bookingCollection.findOne({
      _id: parseInt(bookingId),
    });
    if (!booking) {
      throw new Error(`No booking found with ID ${bookingId}`);
    }

    // Generate new notification ID
    const counter = await countersCollection.findOneAndUpdate(
      { _id: "docterNotificationId" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    const newNotificationId = counter.seq;

    const date = new Date(); // Assuming dateString is not defined in your function
    const options = { day: "numeric", month: "long" };
    let bookingDate = date.toLocaleDateString("en-GB", options);

    const dateInIST = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });

    let message;
    if (type === 10) {
      message = `New Booking ${bookingId} has been recorded for ${bookingDate} ${booking.time}.`;
    } else if (type === 11) {
      message = `Reminder for Booking ${bookingId} on ${bookingDate} ${booking.time}`;
    } else if (type === 12) {
      message = `Appointment Done for Appointment ${bookingId}. Payment is generated.`;
    } else if (type === 13) {
      message = `Payment ${bookingId} for order is in process`;
    } else if (type === 14) {
      message = `Payment ${bookingId} for order is in process`;
    } else {
      message = `Notification type ${type} is not recognized`;
    }

    const notification = {
      userId: parseInt(userId),
      userType: 2,
      message: message,
      date: dateInIST,
      read: false,
      type: type,
      status: "pending",
      _id: newNotificationId,
    };

    const result = await notificationsCollection.insertOne(notification);

    if (!result.acknowledged) {
      throw new Error("Failed to insert notification");
    }
  } catch (error) {
    console.error("Error sending notification1:", error.message);
  } finally {
    await client.close();
  }
}

module.exports = {
  create,
  getAllNotification,
  update,
  remove,
  getNotificationbyId,
  sendDoctorNotification,
};
