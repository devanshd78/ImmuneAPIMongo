const bcrypt = require("bcrypt");
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

// Pharma login controller

const storage = multer.memoryStorage();
const upload = multer({ storage });

async function registerUser(req, res) {
  const {
    name,
    address,
    phoneNumber,
    location,
    licenseNo,
    email,
    accountHolderName,
    accountNumber,
    ifscCode,
    bankName,
    otp,
  } = req.body;

  let validations = [];
  let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
  if (email && !emailRegex.test(email))
    validations.push({ key: "email", message: "Email is not valid" });

  if (!phoneNumber)
    validations.push({
      key: "phoneNumber",
      message: "Phone number is required",
    });
  if (!licenseNo)
    validations.push({ key: "licenseNo", message: "LicenseNo is required" });
  if (!location)
    validations.push({ key: "location", message: "location is required" });
  if (!req.file || !req.file.buffer)
    validations.push({
      key: "licenseImg",
      message: "License image is required",
    });
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

  if (validations.length) {
    res.status(400).json({ status: "error", validations: validations });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Pharmacy");
    const countersCollection = db.collection("Counters");

    const existingUser = await collection.findOne({ phoneNumber });
    if (existingUser) {
      res
        .status(400)
        .json({ status: "error", message: "Phone Number already exists" });
      return;
    }

    if (otp) {
      // OTP verification
      const storedOtp = otpStorage[phoneNumber];
      if (storedOtp && Date.now() < storedOtp.expiry) {
        if (storedOtp.value === otp) {
          // OTP verified, proceed with registration

          const counter = await countersCollection.findOneAndUpdate(
            { _id: "userId" },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: "after" }
          );
          const newId = counter.seq;

          // Prepare S3 upload parameters for license image
          const fileExtension = path.extname(req.file.originalname); // Get file extension
          const fileName = `pharmacy_${newId}_${uuidv4()}${fileExtension}`; // Unique file name
          const s3Params = {
            Bucket: "uploads.immplus.in", // Your S3 bucket name
            Key: `pharmacy/${fileName}`, // File path in the bucket
            Body: req.file.buffer,
            ContentType: req.file.mimetype, // Ensure the file's MIME type is set correctly
          };

          // Upload to S3
          const s3Response = await s3.upload(s3Params).promise();
          const licenseImgUrl = s3Response.Location; // S3 URL for the uploaded image

          const result = await collection.insertOne({
            name,
            address,
            phoneNumber,
            location,
            licenseNo,
            licenseImg: licenseImgUrl, // Save the S3 image URL in the database
            email,
            accountHolderName,
            accountNumber,
            ifscCode,
            bankName,
            _id: newId,
          });

          if (result.acknowledged === true) {
            res.status(200).json({
              status: "success",
              message: "User registered successfully",
              userInfo: result,
            });
          } else {
            res
              .status(400)
              .json({ status: "error", message: "Registration failed" });
          }
        } else {
          res.status(400).json({ status: "error", message: "Invalid OTP" });
        }
      } else {
        res
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
      res.json({ status: "success", message: "OTP sent to your phone number" });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "An error occurred during registration",
      reason: error.message,
    });
  } finally {
    //await client.close();
  }
}

async function loginUser(req, res) {
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
    const collection = db.collection("Pharmacy");

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

          if (user) {
            if (user.isApproved == 1) {
              const userInfo = {
                name: user.name,
                id: user._id,
                address: user.address,
                licenseNo: user.licenseNo,
                phoneNumber: user.phoneNumber,
                previousHistory: user.previousHistory,
                licenseImg: user.licenseImg,
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
            res
              .status(400)
              .json({ status: "error", message: "Invalid Phone Number" });
          }

          client.close();
        } else {
          res.status(400).json({ status: "error", message: "Invalid OTP" });
        }
      } else {
        res
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
      res.json({ status: "success", message: "OTP sent to your phone number" });
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

async function updateUser(req, res) {
  const {
    name,
    password,
    address,
    phoneNumber,
    licenseNo,
    email,
    id,
    accountHolderName,
    accountNumber,
    ifscCode,
    bankName,
  } = req.body;

  let validations = [];
  let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;
  let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ID validation
  if (!id) validations.push({ key: "id", message: "Pharmacy ID is required" });

  // Password validation
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

  // Email validation
  if (email && !emailRegex.test(email))
    validations.push({ key: "email", message: "Email is not valid" });

  if (validations.length) {
    res.status(400).json({ status: "error", validations: validations });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Pharmacy");

    // Find the user by ID
    const user = await collection.findOne({ _id: parseInt(id) });

    if (!user) {
      res.status(400).json({ status: "error", message: "User not found" });
      return;
    }

    // Fields to update
    const updatedFields = {};
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updatedFields.password = hashedPassword;
    }
    if (address) updatedFields.address = address;
    if (name) updatedFields.name = name;
    if (email) updatedFields.email = email;
    if (licenseNo) updatedFields.licenseNo = licenseNo;
    if (phoneNumber) updatedFields.phoneNumber = phoneNumber;
    if (accountNumber) updatedFields.accountNumber = accountNumber;
    if (ifscCode) updatedFields.ifscCode = ifscCode;
    if (accountHolderName) updatedFields.accountHolderName = accountHolderName;
    if (bankName) updatedFields.bankName = bankName;

    // License Image upload handling to S3
    if (req.file && req.file.buffer) {
      const fileExtension = path.extname(req.file.originalname); // Get file extension
      const fileName = `pharmacy_${id}_${uuidv4()}${fileExtension}`; // Generate unique file name
      const s3Params = {
        Bucket: "uploads.immplus.in", // Your S3 bucket name
        Key: `pharmacy/${fileName}`, // Folder for pharmacy license images in S3
        Body: req.file.buffer,
        ContentType: req.file.mimetype, // Ensure MIME type is set correctly
      };

      // Upload to S3
      const s3Response = await s3.upload(s3Params).promise();
      const imageUrl = s3Response.Location; // S3 URL for the uploaded image
      updatedFields.licenseImg = imageUrl; // Save image URL to the licenseImg field
    }

    // Perform the update
    const result = await collection.updateOne(
      { _id: parseInt(id) },
      { $set: updatedFields }
    );

    // Check if any fields were modified
    if (result.modifiedCount > 0) {
      res
        .status(200)
        .json({ status: "success", message: "User updated successfully" });
    } else {
      res
        .status(400)
        .json({ status: "error", message: "Failed to update user" });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "An error occurred during update",
      reason: error.message || error,
    });
  } finally {
    //await client.close();
  }
}

// Delete user controller
async function deleteUser(req, res) {
  const { id } = req.body;

  if (!id) {
    res.status(400).json({ status: "error", message: "User ID is required" });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Pharmacy");

    const user = await collection.findOne({ _id: id });

    if (!user) {
      res.status(400).json({ status: "error", message: "User not found" });
      return;
    }

    const result = await collection.deleteOne({ _id: id });

    if (result.deletedCount > 0) {
      res
        .status(200)
        .json({ status: "success", message: "User deleted successfully" });
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
    // await client.close();
  }
}

async function getAll(req, res) {
  try {
    const db = client.db("ImmunePlus");
    const collection = db.collection("Pharmacy");

    const users = await collection.find().toArray();
    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch users", error: error.message });
  }
}

async function Dashboard(req, res) {
  const { id } = req.query;

  if (!id) {
    res
      .status(400)
      .json({ status: "error", message: "Pharamcy ID is required" });
    return;
  }
  try {
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Orders");

    const data = await collection
      .find({ assignedPharmacy: parseInt(id) })
      .toArray();

    const today = new Date().toISOString().split("T")[0];

    const stats = data.reduce(
      (acc, order) => {
        // Ensure date is in string format
        const orderDate = new Date(order.date).toISOString().split("T")[0]; // Extract date in YYYY-MM-DD format

        acc.totalOrders += 1;

        if (order.status > 0 && order.status <= 7) {
          acc.runingOrder += 1;
        }
        if (orderDate === today) {
          acc.todayOrder += 1;
        }

        if (Array.isArray(order.products)) {
          acc.money += order.products.reduce(
            (total, item) => total + item.price,
            0
          );
        }
        return acc;
      },
      {
        totalOrders: 0,
        todayOrder: 0,
        runingOrder: 0,
        money: 0,
      }
    );

    res.json(stats);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch data", error: error.message });
  }
}

async function getOngoingOrder(req, res) {
  const { id } = req.query;

  if (!id) {
    res
      .status(400)
      .json({ status: "error", message: "Pharamcy ID is required" });
    return;
  }
  try {
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Orders");

    const orders = await collection
      .find({
        status: { $gte: 1, $lte: 4 },
        assignedPharmacy: parseInt(id),
      })
      .toArray();

    res.json(orders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch data", error: error.message });
  }
}
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

async function getOrderbyId(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "Order ID is required" });
    return;
  }
  try {
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Orders");
    const orders = await collection
      .find({ assignedPharmacy: parseInt(id) })
      .toArray();

    if (orders.length === 0) {
      res.status(404).json({ status: "error", message: "No Data found" });
      return;
    }

    // Group and format the orders by date
    const formattedOrders = orders.reduce((acc, curr) => {
      const dateStr = new Date(curr.date).toDateString(); // Format date
      const existingDate = acc.find((item) => item.date === dateStr);

      if (existingDate) {
        existingDate.info.push(curr);
      } else {
        acc.push({ date: dateStr, info: [curr] });
      }

      return acc;
    }, []);

    res.json(formattedOrders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch Data", error: error.message });
  }
}

async function getPharmabyId(req, res) {
  const { id } = req.query;

  if (!id) {
    res
      .status(400)
      .json({ status: "error", message: "Pharmacy ID is required" });
    return;
  }
  try {
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Pharmacy");
    const pharmacy = await collection.find({ _id: parseInt(id) }).toArray();
    if (pharmacy.length === 0) {
      res.status(404).json({ status: "error", message: "Pharmacy not found" });
    } else {
      res.json(pharmacy);
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch Pharmacy", error: error.message });
  }
}

module.exports = {
  loginUser,
  registerUser,
  updateUser,
  deleteUser,
  getAll,
  Dashboard,
  upload,
  getOngoingOrder,
  getOrderbyId,
  getPharmabyId,
};
