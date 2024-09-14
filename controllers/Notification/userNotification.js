const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { MongoClient, ServerApiVersion } = require("mongodb");
const url =
  "mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/?retryWrites=true&w=majority&appName=ImmunePlus";

const client = new MongoClient(process.env.UU, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Multer configuration for memory storage
// type
// 1= order Received;
// 2= Order Confirmed;
// 3= rider on its way to medical store
// 4= rider checked meds;
// 5= rider left;
// 6= rider reached destination
// 7= order delivered

async function create(req, res) {
  try {
    await client.connect();
    const { userId, message, type } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("userNotification");
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
      { _id: "userNotificationId" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    const newId = counter.seq;
    const dateInIST = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });
    const notification = {
      userId: parseInt(userId),
      userType: 1,
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
    const collection = db.collection("userNotification");

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
    const collection = db.collection("userNotification");

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
    await client.connect();
    const { id } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("userNotification");

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
    const collection = db.collection("userNotification");
    const noti = await collection.find({ userId: parseInt(id) }).toArray();
    res.json(noti);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch notification", error: error.message });
  }
}
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  service: "gmail", // Use your email service
  auth: {
    user: "devanshd78@gmail.com", // Your email
    pass: "1@Devansh", // Your email password
  },
});

function sendNotificationEmail(booking) {
  const mailOptions = {
    from: "devanshd78@gmail.com", // Sender address
    to: "rsrisabhsingh212@gmail.com", // List of recipients
    subject: "Booking Reminder",
    text: `You have a booking scheduled with Doctor ID ${booking.doctorId} on ${booking.date} at ${booking.time}.`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log("Email sent: " + info.response);
  });
}

cron.schedule("* * * * *", async () => {
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const bookingsCollection = db.collection("appointments");

    const now = new Date();
    const oneMinuteFromNow = new Date(now.getTime() + 60000);

    // Fetch bookings that are one minute away and have only one slot left
    const bookings = await bookingsCollection
      .find({
        date: {
          $gte: new Date(now.toISOString().split("T")[0]), // today
          $lte: new Date(now.toISOString().split("T")[0] + "T23:59:59.999Z"), // end of today
        },
        time: {
          $gte: now.toISOString().split("T")[1], // current time
          $lte: oneMinuteFromNow.toISOString().split("T")[1], // one minute from now
        },
      })
      .toArray();

    bookings.forEach((booking) => {
      // Check if there is only one slot left
      // Assuming you have a way to determine the total slots and booked slots
      const totalSlots = 10; // Example total slots
      const bookedSlots = 9; // Example booked slots, this should come from your database

      if (totalSlots - bookedSlots === 1) {
        sendNotificationEmail(booking);
      }
    });
  } catch (error) {
    console.error("Error checking bookings:", error);
  } finally {
    // await client.close();
  }
});

async function sendUserNotification(userId, orderId, type, otp) {
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const notificationsCollection = db.collection("userNotification");
    const countersCollection = db.collection("Counters");

    // Generate new notification ID
    const counter = await countersCollection.findOneAndUpdate(
      { _id: "userNotificationId" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    const newNotificationId = counter.seq; // Changed to counter.value.seq

    let booking = null;
    let bookingDate = "";
    if (type === 10 || type === 11) {
      const bookingCollection = db.collection("appointments");
      booking = await bookingCollection.findOne({ _id: orderId });
      if (booking) {
        const date = new Date(); // Use current date if `dateString` is not defined
        const options = { day: "numeric", month: "long" };
        bookingDate = date.toLocaleDateString("en-GB", options);
      }
    }

    let message;
    switch (type) {
      case 1:
        message = `Your Order ${orderId} has been recorded. We will try to find the best suitable pharmacy to get your Medicines.`;
        break;
      case 2:
        message = `Your Order ${orderId} has been confirmed. Your OTP for order is ${otp}`;
        break;
      case 3:
        message = `Our Rider is on its way to the medical store to pick your Medicines for Order ${orderId}`;
        break;
      case 4:
        message = `Rider checked your Medicines & left for your destination for order ${orderId}`;
        break;
      case 5:
        message = `Rider reached destination for order ${orderId}`;
        break;
      case 6:
        message = `Your Order ${orderId} has been delivered`;
        break;
      case 10:
        message = booking
          ? `New Booking ${orderId} has been recorded for ${bookingDate} ${booking.time}.`
          : `New Booking ${orderId} has been recorded.`;
        break;
      case 11:
        message = booking
          ? `Reminder for Booking ${orderId} on ${bookingDate} ${booking.time}`
          : `Reminder for Booking ${orderId}`;
        break;
      case 12:
        message = `Appointment Completed ${orderId}.`;
        break;
      default:
        message = `Notification type ${type} is not recognized.`;
        break;
    }

    const dateInIST = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });
    const notification = {
      userId: parseInt(userId),
      userType: 1,
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
    console.error("Error sending notification:", error.message);
  } finally {
    // Ensure client is closed in the `finally` block
    await client.close();
  }
}

module.exports = {
  create,
  getAllNotification,
  update,
  remove,
  getNotificationbyId,
  sendUserNotification,
};
