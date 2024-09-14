const bcrypt = require("bcrypt");
const { MongoClient, ServerApiVersion } = require("mongodb");
const User = require("../models/User");
const client = new MongoClient(process.env.UU, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
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

async function loginUser(req, res) {
  const { phoneNumber, otp } = req.body;
  let validations = [];
  let phoneNumMessage = "";

  if (!phoneNumber) {
    phoneNumMessage = "Phone Number is required.";
  } else if (phoneNumber.length < 10 || phoneNumber.length > 10) {
    phoneNumMessage = "Phone Number should habe 10 digits.";
  }

  if (phoneNumMessage) {
    validations.push({ key: "Phone Number", message: phoneNumMessage });
  }

  if (validations.length) {
    res.status(400).json({ status: "error", validations: validations });
    return;
  }

  try {
    if (otp) {
      // OTP verification
      const storedOtp = otpStorage[phoneNumber];
      if (storedOtp && Date.now() < storedOtp.expiry) {
        if (storedOtp.value === otp) {
          // Successful OTP verification
          await client.connect();
          const db = client.db("ImmunePlus");
          const collection = db.collection("Users");

          const user = await collection.findOne({ phoneNumber: phoneNumber });
          if (user) {
            const userInfo = {
              fullName: user.fullName,
              id: user._id,
              gender: user.gender,
              address: user.address,
              state: user.state,
              ageGroup: user.ageGroup,
              email: user.email,
              pincode: user.pincode,
              phoneNumber: user.phoneNumber,
              previousHistory: user.previousHistory,
            };

            res.json({
              status: "success",
              message: "Login successful!",
              user: userInfo,
            });
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
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

// User registration controller
async function registerUser(req, res) {
  const {
    address,
    fullName,
    ageGroup,
    email,
    gender,
    state,
    pincode,
    phoneNumber,
    previousHistory,
    otp // Added for OTP verification
  } = req.body;

  let validations = [];
  let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;
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



  if (!address) validations.push({ key: "address", message: "Address is required" });
  if (!fullName) validations.push({ key: "fullName", message: "Full name is required" });
  if (email && !emailRegex.test(email)) validations.push({ key: "email", message: "Email is not valid" });
  if (!gender) validations.push({ key: "gender", message: "Gender is required" });
  if (!state) validations.push({ key: "state", message: "State is required" });
  if (!pincode) validations.push({ key: "pincode", message: "Pincode is required" });
  if (!phoneNumber) validations.push({ key: "phoneNumber", message: "Phone number is required" });
  if (!ageGroup) validations.push({ key: "ageGroup", message: "Age Group is required" });

  if (validations.length) {
    res.status(400).json({ status: "error", validations: validations });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Users");
    const countersCollection = db.collection("Counters");

    const existingUser = await collection.findOne({ phoneNumber });
    if (existingUser) {
      res.status(400).json({ status: "error", validations: "Phone Number already exists." });
      return;
    }
    if (otp) {
      // OTP verification
      const storedOtp = otpStorage[phoneNumber];
      if (storedOtp && Date.now() < storedOtp.expiry) {
        if (storedOtp.value === otp) {
          // OTP verified, proceed with registration



          if (existingUser) {
            res.status(400).json({ status: "error", message: "Phone Number already exists" });
          } else {

            const counter = await countersCollection.findOneAndUpdate(
              { _id: "userId" },
              { $inc: { seq: 1 } },
              { upsert: true, returnDocument: "after" }
            );
            const newId = counter.seq;

            const result = await collection.insertOne({
              address,
              fullName,
              ageGroup,
              email,
              gender,
              state,
              pincode,
              phoneNumber,
              previousHistory,
              _id: newId,
            });

            if (result.acknowledged === true) {
              res.status(200).json({ status: "success", message: "User registered successfully", userInfo: result });
            } else {
              res.status(400).json({ status: "error", message: "Registration failed" });
            }
          }
        } else {
          res.status(400).json({ status: "error", message: "Invalid OTP" });
        }
      } else {
        res.status(400).json({ status: "error", message: "OTP expired or invalid" });
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

async function updateUser(req, res) {
  const {
    id,
    address,
    fullName,
    ageGroup,
    email,
    gender,
    state,
    pincode,
    phoneNumber,
    previousHistory,
  } = req.body;
  let validations = [];
  let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;
  let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!id) validations.push({ key: "id", message: "User ID is required" });


  if (email && !emailRegex.test(email))
    validations.push({ key: "email", message: "Email is not valid" });

  if (validations.length) {
    res.status(400).json({ status: "error", validations: validations });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Users");

    const user = await collection.findOne({ _id: id });

    if (!user) {
      res.status(400).json({ status: "error", message: "User not found" });
      return;
    }

    const updatedFields = {};

    if (address) updatedFields.address = address;
    if (fullName) updatedFields.fullName = fullName;
    if (ageGroup) updatedFields.ageGroup = ageGroup;
    if (email) updatedFields.email = email;
    if (gender) updatedFields.gender = gender;
    if (state) updatedFields.state = state;
    if (pincode) updatedFields.pincode = pincode;
    if (phoneNumber) updatedFields.phoneNumber = phoneNumber;
    if (previousHistory) updatedFields.previousHistory = previousHistory;

    const result = await collection.updateOne({ _id }, { $set: updatedFields });

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
      reason: error,
    });
  } finally {
    // await client.close();
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
    const collection = db.collection("Users");

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
    const collection = db.collection("Users");

    const users = await collection.find().toArray();
    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch users", error: error.message });
  }
}

async function getUserbyId(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "User ID is required" });
    return;
  }
  try {
    const db = client.db("ImmunePlus");
    const collection = db.collection("Users");
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

async function getUserAppointment(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "Docter ID is required" });
    return;
  }
  try {
    const db = client.db("ImmunePlus");
    const collection = db.collection("appointments");
    const user = await collection.find({ patientId: parseInt(id) }).toArray();
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

async function dummyLoginUser(req, res) {
  const { phoneNumber } = req.body;
  let validations = [];
  let phoneNumMessage = "";

  if (!phoneNumber) {
    phoneNumMessage = "Phone Number is required.";
  } else if (phoneNumber.length < 10 || phoneNumber.length > 10) {
    phoneNumMessage = "Phone Number should habe 10 digits.";
  }

  if (phoneNumMessage) {
    validations.push({ key: "Phone Number", message: phoneNumMessage });
  }

  if (validations.length) {
    res.status(400).json({ status: "error", validations: validations });
    return;
  }

  try {
    // Successful OTP verification
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Users");

    const user = await collection.findOne({ phoneNumber: phoneNumber });
    if (user) {
      const userInfo = {
        fullName: user.fullName,
        id: user._id,
        gender: user.gender,
        address: user.address,
        state: user.state,
        ageGroup: user.ageGroup,
        email: user.email,
        pincode: user.pincode,
        phoneNumber: user.phoneNumber,
        previousHistory: user.previousHistory,
      };

      res.json({
        status: "success",
        message: "Login successful!",
        user: userInfo,
      });
    } else {
      res
        .status(400)
        .json({ status: "error", message: "Invalid Phone Number" });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
}
module.exports = {
  loginUser,
  registerUser,
  updateUser,
  deleteUser,
  getAll,
  getUserbyId,
  getUserAppointment,
  dummyLoginUser,
};
