const bcrypt = require("bcrypt");
const { MongoClient, ServerApiVersion } = require("mongodb");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

let client = new MongoClient(process.env.UU, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
});

const storage = multer.memoryStorage();
const upload = multer({ storage });
const fast2sms = require("fast-two-sms");

const OTP_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes
let otpStorage = {}; // Temporary in-memory storage for OTPs
const crypto = require("crypto");
async function sendOTP(phoneNumber, otp) {
  const apiKey =
    "30YlkFZVrtRHCnOIs7PDUajxwEB4evX1SfmW8cMQiGJhLTpbz6FaB3tfYDXniMQNkThgoylJPA8VH15E";
  // var options = {authorization : apiKey , message : `Your OTP is ${otp}. It is valid for 5 minutes.` ,  numbers : ['7477367855']}
  // fast2sms.sendMessage(options).then(response=>{
  //     console.log(response)
  //   })

  try {
    const options = {
      authorization: apiKey,
      message: `Your OTP is ${otp}. It is valid for 5 minutes.`,
      numbers: [phoneNumber], // Pass numbers as an array
      sender_id: "IMMPLUS", // Specify the sender ID here
    };
    await fast2sms
      .sendMessage(options)
      .then((res) => {
        console.log(res);
      })
      .catch((err) => {
        console.log(err);
      });
    // console.log('OTP sent successfully:', response);
  } catch (error) {
    console.error("Error sending OTP:", error.message);
  }
}

async function registerDelivery(req, res) {
  const {
    fullname,
    phoneNumber,
    address,
    licenseNo,
    experience,
    city,
    accountNumber,
    ifscCode,
    accountHolderName,
    bankName,
    otp,
  } = req.body;

  let validations = [];
  let phoneNumMessage = "";

  if (phoneNumber) {
    if (phoneNumber.length !== 10) {
      phoneNumMessage = "Phone Number should have 10 digits.";
    }
  } else {
    phoneNumMessage = "Phone Number is required.";
  }

  if (phoneNumMessage) {
    validations.push({ key: "phoneNumber", message: phoneNumMessage });
  }

  if (!address)
    validations.push({ key: "address", message: "Address is required" });
  if (!fullname)
    validations.push({ key: "fullname", message: "Full Name is required" });
  if (!licenseNo)
    validations.push({ key: "licenseNo", message: "License No is required" });
  if (!city) validations.push({ key: "city", message: "City is required" });
  if (!experience)
    validations.push({ key: "experience", message: "Experience is required" });
  if (!accountNumber)
    validations.push({
      key: "accountNumber",
      message: "Account Number is required",
    });
  if (!ifscCode)
    validations.push({ key: "ifscCode", message: "IFSC Code is required" });
  if (!accountHolderName)
    validations.push({
      key: "accountHolderName",
      message: "Account Holder Name is required",
    });
  if (!bankName)
    validations.push({ key: "bankName", message: "Bank Name is required" });

  if (
    !req.files ||
    !req.files.licensePhoto ||
    !req.files.licensePhoto[0].buffer
  ) {
    validations.push({
      key: "licensePhoto",
      message: "License Photo is required",
    });
  }
  if (!req.files || !req.files.rcPhoto || !req.files.rcPhoto[0].buffer) {
    validations.push({ key: "rcPhoto", message: "RC Photo is required" });
  }
  if (!req.files || !req.files.profilePic || !req.files.profilePic[0].buffer) {
    validations.push({ key: "profilePic", message: "Profile Pic is required" });
  }

  if (validations.length) {
    return res.status(400).json({ status: "error", validations: validations });
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("DeliveryPartner");
    const countersCollection = db.collection("Counters");

    const existingUser = await collection.findOne({ phoneNumber });
    if (existingUser) {
      return res
        .status(400)
        .json({ status: "error", message: "Phone Number already exists" });
    }

    if (otp) {
      // OTP verification
      const storedOtp = otpStorage[phoneNumber];
      if (storedOtp && Date.now() < storedOtp.expiry) {
        if (storedOtp.value === otp) {
          // OTP verified, proceed with registration

          const counter = await countersCollection.findOneAndUpdate(
            { _id: "deliveryPartnerId" },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: "after" }
          );
          const newId = counter.seq;

          // Prepare S3 upload parameters for each image
          const uploadToS3 = async (buffer, path) => {
            const s3Params = {
              Bucket: "uploads.immplus.in", // Your S3 bucket
              Key: `delivery/${path}/${newId}.png`,
              Body: buffer,
              ContentType: "image/png", // Adjust content type if needed
            };
            const uploadResponse = await s3.upload(s3Params).promise();
            return uploadResponse.Location;
          };

          const licensePhotoUrl = await uploadToS3(
            req.files.licensePhoto[0].buffer,
            "license"
          );
          const rcPhotoUrl = await uploadToS3(
            req.files.rcPhoto[0].buffer,
            "rc"
          );
          const profilePicUrl = await uploadToS3(
            req.files.profilePic[0].buffer,
            "profilePic"
          );

          // Insert the delivery partner's data into the database
          const result = await collection.insertOne({
            _id: newId,
            fullname,
            phoneNumber,
            address,
            licenseNo,
            licensePhoto: licensePhotoUrl, // S3 URL for license photo
            rcPhoto: rcPhotoUrl, // S3 URL for RC photo
            experience,
            city,
            profilePic: profilePicUrl, // S3 URL for profile picture
            accountNumber,
            ifscCode,
            accountHolderName,
            bankName,
            isApproved: 0,
          });

          if (result.acknowledged) {
            return res.status(200).json({
              status: "success",
              message: "Delivery partner registered successfully",
            });
          } else {
            return res
              .status(400)
              .json({ status: "error", message: "Registration failed" });
          }
        } else {
          return res
            .status(400)
            .json({ status: "error", message: "Invalid OTP" });
        }
      } else {
        return res
          .status(400)
          .json({ status: "error", message: "OTP expired or invalid" });
      }
    } else {
      // Generate and send OTP
      const otp = crypto.randomInt(100000, 999999).toString();
      otpStorage[phoneNumber] = {
        value: otp,
        expiry: Date.now() + OTP_EXPIRY_TIME,
      };

      await sendOTP(phoneNumber, otp);
      return res.json({
        status: "success",
        message: "OTP sent to your phone number",
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    return res.status(500).json({
      status: "error",
      message: "An error occurred during registration",
      reason: error.message,
    });
  } finally {
    // await client.close(); // Uncomment if using in a real connection
  }
}

async function loginDelivery(req, res) {
  const { phoneNumber, otp } = req.body;
  let validations = [];
  let phoneNumMessage = "";

  // Validate phone number
  if (!phoneNumber) {
    phoneNumMessage = "Phone Number is required.";
  } else if (phoneNumber.length !== 10) {
    phoneNumMessage = "Phone Number should have 10 digits.";
  }

  if (phoneNumMessage) {
    validations.push({ key: "phoneNumber", message: phoneNumMessage });
  }

  if (validations.length) {
    res.status(400).json({ status: "error", validations: validations });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("DeliveryPartner");

    const user = await collection.findOne({ phoneNumber: phoneNumber });
    if (user.isApproved != 1) {
      res.status(400).json({
        status: "error",
        validations: "Your Account is not Approved yet.",
      });
      return;
    }
    if (otp) {
      // OTP verification
      const storedOtp = otpStorage[phoneNumber];
      if (storedOtp && Date.now() < storedOtp.expiry) {
        if (storedOtp.value === otp) {
          // Successful OTP verification
          await client.connect();
          const db = client.db("ImmunePlus");
          const collection = db.collection("DeliveryPartner");

          const user = await collection.findOne({ phoneNumber: phoneNumber });
          if (user) {
            if (user.isApproved == 1) {
              const userInfo = {
                fullName: user.fullName,
                id: user._id,
                city: user.city,
                licenseNo: user.licenseNo,
                licensePhoto: user.licensePhoto,
                address: user.address,
                experience: user.experience,
                phoneNumber: user.phoneNumber,
                rcPhoto: user.rcPhoto,
                profilePic: user.profilePic,
              };

              res.json({
                status: "success",
                message: "Login successful!",
                user: userInfo,
              });
            } else if (user.isApproved == 2) {
              res.json({
                status: "decline",
                message: "Your Profile has been Declined",
              });
            } else {
              res.json({
                status: "pending",
                message: "Your Profile is not approved",
              });
            }
          } else {
            res.status(400).json({
              status: "error",
              message: "Invalid Phone Number",
            });
          }

          client.close();
        } else {
          res.status(400).json({ status: "error", message: "Invalid OTP" });
        }
      } else {
        res.status(400).json({
          status: "error",
          message: "OTP expired or invalid",
        });
      }
    } else {
      // Generate and send OTP
      const otp = crypto.randomInt(100000, 999999).toString();
      otpStorage[phoneNumber] = {
        value: otp,
        expiry: Date.now() + OTP_EXPIRY_TIME,
      };

      await sendOTP(phoneNumber, otp);
      res.json({
        status: "success",
        message: "OTP sent to your phone number",
      });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "An error occurred during login",
      reason: error.message,
    });
  } finally {
    //await client.close();
  }
}

async function updateDelivery(req, res) {
  const {
    id,
    password,
    address,
    fullName,
    licenseNo,
    experience,
    city,
    phoneNumber,
    accountNumber,
    ifscCode,
    accountHolderName,
    bankName,
  } = req.body;
  let validations = [];
  let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;

  // Validation checks
  if (!id)
    validations.push({ key: "id", message: "Delivery Partner ID is required" });

  if (
    password &&
    (password.length < 8 || password.length > 20 || !regex.test(password))
  ) {
    validations.push({
      key: "password",
      message:
        "Password should be between 8 to 20 characters, contain at least one number, one special character, and one uppercase letter.",
    });
  }

  if (validations.length) {
    return res.status(400).json({ status: "error", validations });
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("DeliveryPartner");

    // Find the existing delivery partner by ID
    const user = await collection.findOne({ _id: parseInt(id) });

    if (!user) {
      return res
        .status(400)
        .json({ status: "error", message: "Delivery Partner not found" });
    }

    const updatedFields = {};

    // Hash the password if provided
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updatedFields.password = hashedPassword;
    }
    // Update other fields if they exist
    if (address) updatedFields.address = address;
    if (fullName) updatedFields.fullName = fullName;
    if (licenseNo) updatedFields.licenseNo = licenseNo;
    if (experience) updatedFields.experience = experience;
    if (city) updatedFields.city = city;
    if (phoneNumber) updatedFields.phoneNumber = phoneNumber;
    if (accountNumber) updatedFields.accountNumber = accountNumber;
    if (ifscCode) updatedFields.ifscCode = ifscCode;
    if (accountHolderName) updatedFields.accountHolderName = accountHolderName;
    if (bankName) updatedFields.bankName = bankName;

    // Handle file uploads to S3
    if (req.files) {
      if (req.files.licensePhoto && req.files.licensePhoto[0]) {
        const licenseS3Params = {
          Bucket: "uploads.immplus.in", // Your S3 bucket name
          Key: `delivery/license/${id}.png`, // S3 key for license photo
          Body: req.files.licensePhoto[0].buffer,
          ContentType: req.files.licensePhoto[0].mimetype,
        };
        const licenseUpload = await s3.upload(licenseS3Params).promise();
        updatedFields.licensePhoto = licenseUpload.Location; // Save S3 URL
      }
      if (req.files.rcPhoto && req.files.rcPhoto[0]) {
        const rcS3Params = {
          Bucket: "uploads.immplus.in",
          Key: `delivery/rc/${id}.png`,
          Body: req.files.rcPhoto[0].buffer,
          ContentType: req.files.rcPhoto[0].mimetype,
        };
        const rcUpload = await s3.upload(rcS3Params).promise();
        updatedFields.rcPhoto = rcUpload.Location;
      }
      if (req.files.profilePic && req.files.profilePic[0]) {
        const profilePicS3Params = {
          Bucket: "uploads.immplus.in",
          Key: `delivery/profilePic/${id}.png`,
          Body: req.files.profilePic[0].buffer,
          ContentType: req.files.profilePic[0].mimetype,
        };
        const profilePicUpload = await s3.upload(profilePicS3Params).promise();
        updatedFields.profilePic = profilePicUpload.Location;
      }
    }

    // Update the delivery partner's record in the database
    const result = await collection.updateOne(
      { _id: parseInt(id) },
      { $set: updatedFields }
    );

    // Check if the update was successful
    if (result.modifiedCount > 0) {
      return res.status(200).json({
        status: "success",
        message: "Delivery Partner updated successfully",
      });
    } else {
      return res
        .status(400)
        .json({ status: "error", message: "Failed to update user" });
    }
  } catch (error) {
    // Error handling
    return res.status(500).json({
      status: "error",
      message: "An error occurred during update",
      reason: error.message,
    });
  }
}

// Delete user controller
async function deleteDelivery(req, res) {
  const { id } = req.body;

  if (!id) {
    res
      .status(400)
      .json({ status: "error", message: "Delivery Partner ID is required" });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("DeliveryPartner");

    const user = await collection.findOne({ _id: parseInt(id) });

    if (!user) {
      res
        .status(400)
        .json({ status: "error", message: "Delivery Partner not found" });
      return;
    }

    const result = await collection.deleteOne({ _id: id });

    if (result.deletedCount > 0) {
      res.status(200).json({
        status: "success",
        message: "Delivery Partner deleted successfully",
      });
    } else {
      res
        .status(400)
        .json({ status: "error", message: "Failed to delete user" });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "An error occurred during deletion",
      reason: error,
    });
  } finally {
    //await client.close();
  }
}

async function getAll(req, res) {
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("DeliveryPartner");

    const users = await collection.find().toArray();
    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch users", error: error.message });
  }
}

async function getAvailableOrders(req, res) {
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const ordersCollection = db.collection("acceptedOrders");
    const pharmacyCollection = db.collection("Pharmacy"); // Change the collection to "pharmacies"

    const orders = await ordersCollection
      .find({ assignedPartner: null })
      .toArray();

    // Enrich orders with pharmacy address
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const pharmacy = await pharmacyCollection.findOne({
          _id: order.assignedPharmacy,
        });
        return {
          ...order,
          pharmacyAddress: pharmacy?.address || "Address not found", // Add the address to the order
        };
      })
    );

    res.json(enrichedOrders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch Orders", error: error.message });
  } finally {
    // await client.close(); // Ensure the client connection is closed after the operation
  }
}

async function getUserbyId(req, res) {
  const { id } = req.query;

  if (!id) {
    res
      .status(400)
      .json({ status: "error", message: "Delivery Partner ID is required" });
    return;
  }
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("DeliveryPartner");
    const user = await collection.find({ _id: parseInt(id) }).toArray();
    if (user.length === 0) {
      res
        .status(404)
        .json({ status: "error", message: "Delivery Partner not found" });
    } else {
      res.json(user);
    }
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch Delivery Partner",
      error: error.message,
    });
  }
}

async function assignOrderToPartner(req, res) {
  const { orderId, id } = req.body;
  if (!orderId) {
    res.status(400).json({ status: "error", message: "Order ID is required" });
    return;
  }
  if (!id) {
    res.status(400).json({ status: "error", message: "User ID is required" });
    return;
  }
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const ordersCollection = db.collection("Orders");
    const paymentCollection = db.collection("paymentDelivery");
    const countersCollection = db.collection("Counters");

    // Check if the order has an assigned partner
    const order = await ordersCollection.findOne({ _id: orderId });
    if (!order) {
      res.status(404).json({ status: "error", message: "Order not found" });
      return;
    }

    if (order.assignedPartner) {
      res.status(400).json({ status: "error", message: "Order already taken" });
      return;
    }

    // Update order with assigned partner
    await ordersCollection.updateOne(
      { _id: orderId },
      { $set: { assignedPartner: id, status: 3 } }
    );

    // Generate new payment ID
    const counter = await countersCollection.findOneAndUpdate(
      { _id: "paymentId" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    const newPaymentId = counter.seq;
    const dateInIST = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });

    // Create payment info
    const paymentInfo = {
      _id: newPaymentId,
      userId: id,
      orderId: orderId,
      totalPrice: 500,
      type: 3,
      date: dateInIST,
      status: 0,
    };

    // Insert payment info
    const result = await paymentCollection.insertOne(paymentInfo);

    if (result.acknowledged) {
      res.status(200).json({
        status: "success",
        message: "Payment created successfully",
        paymentId: newPaymentId,
      });
    } else {
      throw new Error("Failed to create payment");
    }
  } catch (error) {
    console.error("Error assigning order to pharmacy:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  } finally {
    await client.close();
  }
}

async function getUserbyId(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "User ID is required" });
    return;
  }
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("DeliveryPartner");
    const user = await collection.find({ _id: parseInt(id) }).toArray();
    if (user.length === 0) {
      res.status(404).json({ status: "error", message: "User not found" });
    } else {
      res.json(user);
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch User", error: error.message });
  }
}

let isConnected = false;
async function connectToDatabase() {
  if (!isConnected) {
    try {
      await client.connect();
      isConnected = true;
    } catch (err) {
      throw err;
    }
  }
}
async function Dashboard(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "User ID is required" });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const ordersCollection = db.collection("Orders");
    const paymentsCollection = db.collection("paymentDelivery");

    const today = new Date().toISOString().split("T")[0];

    // Fetch all orders assigned to the partner
    const ordersData = await ordersCollection
      .find({ assignedPartner: parseInt(id) })
      .toArray();

    // Calculate stats from orders
    const stats = ordersData.reduce(
      (acc, order) => {
        const orderDate = new Date(order.date).toISOString().split("T")[0]; // Extract date in YYYY-MM-DD forma

        if (orderDate === today) {
          acc.todayOrder += 1;
          acc.money += 50;
          if (order.status > 3 && order.status < 7) {
            acc.runningOrder += 1;
          } else if (order.status >= 7) {
            acc.totalOrderDelivered += 1;
          }
        }

        return acc;
      },
      {
        totalOrderDelivered: 0,
        todayOrder: 0,
        runningOrder: 0,
        money: 0,
      }
    );

    // Calculate total payments due
    const paymentsDue = await paymentsCollection
      .aggregate([
        { $match: { userId: parseInt(id), status: { $in: [0, 1] } } },
        { $group: { _id: null, totalDue: { $sum: "$amount" } } },
      ])
      .toArray();

    const totalPaymentsDue =
      paymentsDue.length > 0 ? paymentsDue[0].totalDue : 0;

    // Include total payments due in the response
    res.json({
      totalOrderDelivered: stats.totalOrderDelivered,
      todayOrder: stats.todayOrder,
      runningOrder: stats.runningOrder,
      moneyMadeToday: stats.money,
      totalPaymentsDue: totalPaymentsDue,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch data", error: error.message });
  } finally {
    //await client.close();
  }
}

async function getOrderHistoryById(req, res) {
  const { id } = req.query;

  if (!id) {
    res
      .status(400)
      .json({ status: "error", message: "Delivery Partner ID is required" });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const ordersCollection = db.collection("Orders");

    // Find orders assigned to the delivery partner
    const orders = await ordersCollection
      .find({ assignedPartner: parseInt(id) })
      .toArray();

    if (orders.length === 0) {
      res.status(404).json({
        status: "error",
        message: "No orders found for this Delivery Partner",
      });
    } else {
      res.json({ status: "success", orders });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching order history",
      reason: error.message,
    });
  } finally {
    //await client.close();
  }
}

module.exports = {
  registerDelivery,
  loginDelivery,
  updateDelivery,
  deleteDelivery,
  assignOrderToPartner,
  getAll,
  getAvailableOrders,
  getUserbyId,
  Dashboard,
  getOrderHistoryById,
  upload,
};
