const bcrypt = require("bcrypt");
const { MongoClient, ServerApiVersion } = require("mongodb");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const User = require("../models/User");
const DoctorAvailability = require("../models/Availability");
const Appointment = require("../models/Appointments");
const { sendDoctorNotification } = require("./Notification/docterNotification");
const { sendUserNotification } = require("./Notification/userNotification");


let client = new MongoClient(process.env.UU, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
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

// Example usage of the connectToDatabase function
connectToDatabase()
  .then(() => {
    // You can perform database operations here
  })
  .catch((err) => {
    console.error("Error connecting to the database:", err);
  });

const storage = multer.memoryStorage();
const upload = multer({ storage });

const mongoose = require("mongoose");

async function bookAppointment(req, res) {
  try {
    await connectToDatabase();
    await client.connect();
    const {
      scheduleId,
      patientId,
      type,
      appointmentFor,
      fullName,
      age,
      gender,
      phoneNumber,
      medicalHistory,
    } = req.body;
    const db = client.db("ImmunePlus");
    const availabilitiesCollection = db.collection("doctoravailabilities");
    const appointmentsCollection = db.collection("appointments");
    const countersCollection = db.collection("Counters");
    const paymentCollection = db.collection("paymentDocter");
    const docterCollection = db.collection("Doctors");

    // Validate input
    if ((!scheduleId || !patientId || !type, appointmentFor)) {
      res.status(400).json({
        status: "error",
        message:
          "Schedule ID, Type of Appointment and patient name are required",
      });
      return;
    }

    // Find the schedule by its ID
    const schedule = await availabilitiesCollection.findOne({
      _id: parseInt(scheduleId),
    });
    // docId = schedule.doctorId;
    console.log(schedule);
    const docter = await docterCollection.findOne({
      _id: schedule.doctorId,
    });

    if (!schedule) {
      res.status(404).json({
        status: "error",
        message: "No schedule found for the given ID",
      });
      return;
    }

    // Check if there are available slots
    if (schedule.availableSlots <= 0) {
      res.status(400).json({
        status: "error",
        message: "No available slots for the given time",
      });
      return;
    }

    // Decrement the available slots
    if (type == 1) {
      await availabilitiesCollection.updateMany(
        { _id: schedule._id },
        { $inc: { availableSlots: -1, bookedClinic: +1 } }
      );
    } else {
      await availabilitiesCollection.updateMany(
        { _id: schedule._id },
        { $inc: { availableSlots: -1, bookedVideo: +1 } }
      );
    }

    // Create the appointment record
    const counter = await countersCollection.findOneAndUpdate(
      { _id: "bookingId" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    const newId = counter.seq;
    console.log(newId);
    const counter2 = await countersCollection.findOneAndUpdate(
      { _id: "paymentId" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    const newPayementId = counter2.seq;
    const dateInIST = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });
    let totalAmount;
    if (type == 1) {
      totalAmount = docter.appointmentFee;
    } else if (type == 2) {
      totalAmount = docter.videoFee;
    }
    const appointment = {
      _id: newId,
      scheduleId: schedule._id,
      doctorId: schedule.doctorId,
      date: schedule.date,
      time: schedule.time,
      patientId: patientId,
      type: type,
      appointmentFor: appointmentFor,
      fullName: fullName,
      age: age,
      gender: gender,
      phoneNumber: phoneNumber,
      medicalHistory: medicalHistory,
    };

    const paymentInfo = {
      _id: newPayementId,
      bookingId: newId,
      userId: patientId,
      doctorId: schedule.doctorId,
      date: schedule.date,
      time: schedule.time,
      type: 2,
      createdAt: dateInIST,
      status: 0,
      totalAmount: totalAmount,
      amountToBePaid: totalAmount,
    };

    const result = await appointmentsCollection.insertOne(appointment);
    const result2 = await paymentCollection.insertOne(paymentInfo);

    if (result.acknowledged === true && result2.acknowledged == true) {
      res.status(200).json({
        status: "success",
        message: "Appointment booked successfully",
        bookingId: newId,
      });
      sendDoctorNotification(schedule.doctorId, newId, 10);
      sendUserNotification(patientId, newId, 10);
    } else {
      res
        .status(400)
        .json({ status: "error", message: "Failed to book appointment" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to book appointment", error: error.message });
  } finally {
    // await client.close();
  }
}

async function getBookingById(req, res) {
  try {
    await connectToDatabase();
    await client.connect();
    const { id } = req.query;
    const db = client.db("ImmunePlus");
    const appointmentsCollection = db.collection("appointments");

    if (!id) {
      res
        .status(400)
        .json({ status: "error", message: "Booking ID is required" });
      return;
    }

    const appointment = await appointmentsCollection.findOne({
      _id: parseInt(id, 10),
    });

    if (!appointment) {
      res.status(404).json({
        status: "error",
        message: "No appointment found for the given ID",
      });
      return;
    }

    res.status(200).json({ status: "success", appointment });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve appointment",
      error: error.message,
    });
  } finally {
    // await client.close();
  }
}

module.exports = bookAppointment;

async function registerDoctor(req, res) {
  const {
    name,
    hospital,
    about,
    type,
    patients,
    experience,
    rating,
    location,
    specialist,
    videoFee,
    appointmentFee,
    email,
    otp, // Added for OTP verification
    workinghours,
    accountNumber,
    ifscCode,
    accountHolderName,
    bankName,
    phoneNumber
  } = req.body;

  let validations = [];
  let phoneNumMessage = "";
  let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (!email) validations.push({ key: "email", message: "Email is required" });
  else if (!emailRegex.test(email)) {
    validations.push({ key: "email", message: "Email is not valid" });
  }

  if (!name) validations.push({ key: "name", message: "Name is required" });
  if (!hospital) validations.push({ key: "hospital", message: "Hospital is required" });
  if (!about) validations.push({ key: "about", message: "About is required" });
  if (!type) validations.push({ key: "type", message: "Type is required" });
  if (!patients) validations.push({ key: "patients", message: "Patients is required" });
  if (!experience) validations.push({ key: "experience", message: "Experience is required" });
  if (!specialist) validations.push({ key: "specialist", message: "Specialist is required" });
  if (!videoFee) validations.push({ key: "videoFee", message: "Video Fee is required" });
  if (!appointmentFee) validations.push({ key: "appointmentFee", message: "Appointment Fee is required" });
  if (!location) validations.push({ key: "location", message: "Location is required" });
  if (!workinghours) validations.push({ key: "workinghours", message: "Working Hours is required" });
  if (!accountNumber) validations.push({ key: "accountNumber", message: "Account Number is required" });
  if (!ifscCode) validations.push({ key: "ifscCode", message: "IFSC Code is required" });
  if (!accountHolderName) validations.push({ key: "accountHolderName", message: "Account Holder Name is required" });
  if (!bankName) validations.push({ key: "bankName", message: "Bank Name is required" });
  if (!otp) validations.push({ key: "otp", message: "OTP is required" });

  if (!req.file || !req.file.buffer) validations.push({ key: "img", message: "Image is required" });

  if (validations.length) {
    res.status(400).json({ status: "error", validations: validations });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Doctors");
    const countersCollection = db.collection("Counters");

    const existingUser = await collection.findOne({ phoneNumber });

    if (existingUser) {
      res.status(400).json({ status: "error", message: "Phone Number already exists" });
      return;
    }

    if (otp) {
      // OTP verification
      const storedOtp = otpStorage[phoneNumber];
      if (storedOtp && Date.now() < storedOtp.expiry) {
        if (storedOtp.value === otp) {
          // OTP verified, proceed with registration

          const counter = await countersCollection.findOneAndUpdate(
            { _id: "doctorId" },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: "after" }
          );
          const newId = counter.seq;
          const filePath = path.join("uploads/doctor", `${newId}`);

          if (!fs.existsSync("uploads/doctor")) {
            fs.mkdirSync("uploads/doctor", { recursive: true });
          }

          fs.writeFileSync(filePath, req.file.buffer);

          // Save doctor details in the database
          const result = await collection.insertOne({
            _id: newId,
            name,
            hospital,
            about,
            type,
            patients,
            experience,
            rating,
            location,
            specialist,
            videoFee,
            appointmentFee,
            email,
            workinghours,
            accountNumber,
            ifscCode,
            accountHolderName,
            bankName,
            isApproved: 0,
            phoneNumber
          });

          if (result.acknowledged) {
            res.status(200).json({
              status: "success",
              message: "Doctor registered successfully",
              id: newId,
            });
          } else {
            res.status(400).json({ status: "error", message: "Registration failed" });
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


async function createSchedule(req, res) {
  try {
    await connectToDatabase();
    await client.connect();
    const { doctorId, date, workingHours, availableSlots } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("doctoravailabilities");
    const countersCollection = db.collection("Counters");

    // Validations
    let validations = [];
    if (!doctorId)
      validations.push({ key: "doctorId", message: "Doctor ID is required" });
    if (!date) validations.push({ key: "date", message: "Date is required" });
    if (!workingHours || !Array.isArray(workingHours) || !workingHours.length)
      validations.push({
        key: "workingHours",
        message: "Working hours are required and should be a non-empty array",
      });
    if (
      !availableSlots ||
      !Array.isArray(availableSlots) ||
      !availableSlots.length
    )
      validations.push({
        key: "availableSlots",
        message: "Available slots are required and should be a non-empty array",
      });
    if (
      workingHours &&
      availableSlots &&
      workingHours.length !== availableSlots.length
    )
      validations.push({
        key: "mismatch",
        message:
          "Working hours and available slots arrays must have the same length",
      });

    if (validations.length) {
      res.status(400).json({ status: "error", validations: validations });
      return;
    }

    // Check for existing schedules with the same date, time, and doctorId
    const existingSchedules = await collection
      .find({
        doctorId,
        date: new Date(date),
        time: { $in: workingHours },
      })
      .toArray();

    // Prepare the new schedule records
    const scheduleRecords = workingHours.map((time, index) => ({
      doctorId,
      date: new Date(date),
      time,
      availableSlots: availableSlots[index],
      totalslots: availableSlots[index],
      bookedClinic: 0,
      bookedVideo: 0,
    }));

    if (existingSchedules.length > 0) {
      // Update existing schedules
      for (const record of scheduleRecords) {
        await collection.updateOne(
          { doctorId, date: record.date, time: record.time },
          {
            $set: {
              availableSlots: record.availableSlots,
              totalslots: record.totalslots,
            },
          },
          { upsert: true }
        );
      }
      res
        .status(200)
        .json({ status: "success", message: "Schedules updated successfully" });
    } else {
      // Insert new schedule records
      const incrementAmount = workingHours.length;
      const counter = await countersCollection.findOneAndUpdate(
        { _id: "scheduleId" },
        { $inc: { seq: incrementAmount } },
        { upsert: true, returnDocument: "after" }
      );
      const newId = counter.seq;
      const baseId = counter.seq - incrementAmount + 1;

      // Create schedule records
      const scheduleRecords = workingHours.map((time, index) => ({
        _id: baseId + index,
        doctorId,
        date: new Date(date),
        time,
        availableSlots: availableSlots[index],
        totalslots: availableSlots[index],
        bookedClinic: 0,
        bookedVideo: 0,
      }));

      // Insert records into the database
      const result = await collection.insertMany(scheduleRecords);

      if (result.acknowledged === true) {
        res.status(200).json({
          status: "success",
          message: "Schedule created successfully",
        });
      } else {
        res.status(400).json({ status: "error", message: "Creation failed" });
      }
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create schedule", error: error.message });
  } finally {
    //await client.close();
  }
  // dummyJSON:{
  //     "doctorId": 67,
  //     "date": "2024-06-21T04:25:56.731+00:00",
  //     "workingHours": ["10:30", "11:00", "11:30"],
  //     "availableSlots": [10, 5, 2]
  // }
}

async function deleteSchedule(req, res) {
  try {
    const { id } = req.body;
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("doctoravailabilities");

    const result = await collection.deleteOne({ _id: parseInt(id) });
    console.log(result);
    if (result.deletedCount > 0) {
      res.status(200).json({ status: "success", message: "Schedule Deleted" });
    } else {
      res.status(400).json({ status: "error", message: "Delete failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete Schedule", error: error });
  }
}

async function updateTotalSlots(req, res) {
  try {
    await connectToDatabase();
    await client.connect();
    const { id, totalslots } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("doctoravailabilities");

    // Validations
    let validations = [];
    if (!id)
      validations.push({ key: "id", message: "Schedule ID is required" });
    if (totalslots === undefined || isNaN(totalslots) || totalslots < 0)
      validations.push({
        key: "totalslots",
        message: "Total slots must be a non-negative number",
      });

    if (validations.length) {
      res.status(400).json({ status: "error", validations: validations });
      return;
    }

    // Find the existing schedule by _id
    const existingSchedule = await collection.findOne({ _id: parseInt(id) });

    if (!existingSchedule) {
      res.status(404).json({
        status: "error",
        message: "Schedule not found for the given ID",
      });
      return;
    }

    // Update the totalslots field
    const result = await collection.updateOne(
      { _id: parseInt(id) },
      { $set: { totalslots: parseInt(totalslots) } }
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({
        status: "success",
        message: "Total slots updated successfully",
      });
    } else {
      res.status(400).json({ status: "error", message: "Update failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update total slots", error: error.message });
  } finally {
    //await client.close();
  }
}
async function filterSchedules(req, res) {
  try {
    await connectToDatabase();
    await client.connect();
    const { doctorId, date, time } = req.query;
    const db = client.db("ImmunePlus");
    const collection = db.collection("doctoravailabilities");

    // Build the query object
    let query = {};
    if (doctorId) query.doctorId = parseInt(doctorId);
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      query.date = { $gte: start, $lt: end };
    }
    if (time) query.time = time;

    // Debugging output

    // Fetch filtered records from the database
    const result = await collection.find(query).toArray();

    res.status(200).json(result);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to filter schedules", error: error.message });
  } finally {
    //await client.close();
  }
}

async function loginDoctor(req, res) {
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
    const collection = db.collection("Doctors");

    const user = await collection.findOne({ phoneNumber: phoneNumber });
    if (user.isApproved != 1) {
      res.status(400).json({ status: "error", validations: "Your Account is not Approved yet." });
      return;
    }
    if (otp) {
      // OTP verification
      const storedOtp = otpStorage[phoneNumber];
      if (storedOtp && Date.now() < storedOtp.expiry) {
        if (storedOtp.value === otp) {
          // Successful OTP verification

          if (user) {
            const userInfo = {
              name: user.name,
              id: user._id,
              hospital: user.hospital,
              location: user.location,
              about: user.about,
              patients: user.patients,
              img: user.img,
              experience: user.experience,
              workinghours: user.workinghours,
              totalslots: user.totalslots,
              availableSlots: user.availableSlots,
              type: user.type,
              specialist: user.specialist,
              workingDays: user.workingDays,
              videoFee: user.videoFee,
              appointmentFee: user.appointmentFee,
            };

            res.json({
              status: "success",
              message: "Login successful!",
              user: userInfo,
            });
          } else {
            res.status(400).json({ status: "error", message: "Invalid Phone Number" });
          }

          //client.close();
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
      message: "Internal Server Error",
      error: error.message,
    });
  }
}


async function updateDoctor(req, res) {
  try {
    const {
      id,
      name,
      hospital,
      about,
      type,
      patients,
      experience,
      rating,
      workinghours,
      totalslots,
      availableSlots,
      location,
      specialist,
      workingDays,
      videoFee,
      appointmentFee,
      email,
      password,
      accountNumber,
      ifscCode,
      accountHolderName,
      bankName,
    } = req.body;
    let validations = [];
    let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;
    let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!id) validations.push({ key: "id", message: "id is required" });

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

    if (email && !emailRegex.test(email))
      validations.push({ key: "email", message: "Email is not valid" });

    if (validations.length) {
      res.status(400).json({ status: "error", validations: validations });
      return;
    }

    try {
      await connectToDatabase();
      await client.connect();
      const db = client.db("ImmunePlus");
      const collection = db.collection("Doctors");
      const user = await collection.findOne({ _id: parseInt(id) });
      if (!user) {
        res.status(400).json({ status: "error", message: "Doctor not found" });
        return;
      }

      const updatedFields = {};
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updatedFields.password = hashedPassword;
      }
      if (location) updatedFields.location = location;
      if (name) updatedFields.name = name;
      if (hospital) updatedFields.hospital = hospital;
      if (email) updatedFields.email = email;
      if (about) updatedFields.about = about;
      if (patients) updatedFields.patients = patients;
      if (experience) updatedFields.experience = experience;
      if (workinghours) updatedFields.workinghours = workinghours;
      if (totalslots) updatedFields.totalslots = totalslots;
      if (availableSlots) updatedFields.availableSlots = availableSlots;
      if (workingDays) updatedFields.workingDays = workingDays;
      if (videoFee) updatedFields.videoFee = videoFee;
      if (appointmentFee) updatedFields.appointmentFee = appointmentFee;
      if (accountNumber) updatedFields.accountNumber = accountNumber;
      if (ifscCode) updatedFields.ifscCode = ifscCode;
      if (accountHolderName)
        updatedFields.accountHolderName = accountHolderName;
      if (bankName) updatedFields.bankName = bankName;
      if (req.file && req.file.buffer) {
        const filePath = path.join("uploads/doctor", `${id}`);
        if (!fs.existsSync("uploads/doctor")) {
          fs.mkdirSync("uploads/category", { recursive: true });
        }
        fs.writeFileSync(filePath, req.file.buffer);
        updatedFields.img = filePath;
      }

      const result = await collection.updateOne(
        { _id: parseInt(id) },
        { $set: updatedFields }
      );

      if (result.modifiedCount > 0) {
        res
          .status(200)
          .json({ status: "success", message: "Doctor updated successfully" });
      } else {
        res
          .status(400)
          .json({ status: "error", message: "Failed to update Doctor" });
      }
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: "An error occurred during update",
        reason: error,
      });
    } finally {
      //await client.close();
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update Doctor", error: error.message });
  }
}

// Delete Doctor controller
async function deleteDoctor(req, res) {
  const { id } = req.body;

  if (!id) {
    res.status(400).json({ status: "error", message: "Doctor ID is required" });
    return;
  }

  try {
    await connectToDatabase();
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Doctors");

    const user = await collection.findOne({ _id: parseInt(id) });

    if (!user) {
      res.status(400).json({ status: "error", message: "Doctor not found" });
      return;
    }

    const result = await collection.deleteOne({ _id: parseInt(id) });

    if (result.deletedCount > 0) {
      res
        .status(200)
        .json({ status: "success", message: "Doctor deleted successfully" });
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
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Doctors");

    const doctors = await collection.find().toArray();
    res.json(doctors);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch doctors", error: error.message });
  }
}

async function getAllAvailableDocter(req, res) {
  try {
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const collection = db.collection("doctoravailabilities");

    const doctors = await collection.find().toArray();
    res.json(doctors);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch doctors", error: error.message });
  }
}
async function getDocterbyId(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "Docter ID is required" });
    return;
  }
  try {
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Doctors");
    const doctors = await collection.find({ _id: parseInt(id) }).toArray();
    if (doctors.length === 0) {
      res.status(404).json({ status: "error", message: "Doctor not found" });
    } else {
      res.json(doctors);
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch doctors", error: error.message });
  }
}

async function getSchedulebyId(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "Docter ID is required" });
    return;
  }
  try {
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const collection = db.collection("doctoravailabilities");
    const schedule = await collection
      .find({ doctorId: parseInt(id) })
      .toArray();

    if (schedule.length === 0) {
      res.status(404).json({ status: "error", message: "No Data found" });
      return;
    }

    // Group and format the schedule by date
    const formattedSchedule = schedule.reduce((acc, curr) => {
      const dateStr = new Date(curr.date).toDateString(); // Format date
      const existingDate = acc.find((item) => item.date === dateStr);

      if (existingDate) {
        existingDate.info.push(curr);
      } else {
        acc.push({ date: dateStr, info: [curr] });
      }

      return acc;
    }, []);

    res.json(formattedSchedule);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch Data", error: error.message });
  }
}

async function getSchedulebyIdDetails(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "Docter ID is required" });
    return;
  }
  try {
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const collection = db.collection("doctoravailabilities");
    const docCollection = db.collection("Doctors");

    const schedule = await collection.find({ _id: parseInt(id) }).toArray();

    if (schedule.length === 0) {
      res.status(404).json({ status: "error", message: "No Data found" });
      return;
    }
    console.log(schedule[0].doctorId);
    const doctors = await docCollection
      .find({ _id: parseInt(schedule[0].doctorId) })
      .toArray();

    // Group and format the schedule by date
    const formattedSchedule = schedule.reduce((acc, curr) => {
      const dateStr = new Date(curr.date).toDateString(); // Format date
      const existingDate = acc.find((item) => item.date === dateStr);

      if (existingDate) {
        existingDate.info.push(curr);
      } else {
        acc.push({ date: dateStr, info: [curr], doctorInfo: doctors });
      }

      return acc;
    }, []);

    res.json(formattedSchedule);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch Data", error: error.message });
  }
}

async function getScheduleByScheduleId(req, res) {
  const { scheduleId } = req.query;

  if (!scheduleId) {
    res
      .status(400)
      .json({ status: "error", message: "Schedule ID is required" });
    return;
  }

  try {
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const collection = db.collection("doctoravailabilities");

    const schedule = await collection.findOne({ _id: parseInt(scheduleId) });

    if (!schedule) {
      res.status(404).json({ status: "error", message: "No Data found" });
      return;
    }

    const formattedSchedule = {
      date: new Date(schedule.date).toDateString(), // Format date to a readable string
      info: {
        _id: schedule._id,
        doctorId: schedule.doctorId,
        date: schedule.date,
        time: schedule.time,
        availableSlots: schedule.availableSlots,
        totalslots: schedule.totalslots,
        bookedClinic: schedule.bookedClinic,
        bookedVideo: schedule.bookedVideo,
      },
    };

    res.json(formattedSchedule);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch Data", error: error.message });
  }
}

async function getAppointmentbyId(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "Docter ID is required" });
    return;
  }
  try {
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const collection = db.collection("appointments");
    const appointments = await collection
      .find({ doctorId: parseInt(id) })
      .toArray();

    if (appointments.length === 0) {
      res.status(404).json({ status: "error", message: "No Data found" });
      return;
    }

    // Group and format the appointments by date
    const formattedAppointments = appointments.reduce((acc, curr) => {
      const dateStr = new Date(curr.date).toDateString(); // Format date
      const existingDate = acc.find((item) => item.date === dateStr);
      console.log(existingDate, dateStr);
      if (existingDate) {
        existingDate.info.push(curr);
      } else {
        acc.push({ date: dateStr, info: [curr] });
      }

      return acc;
    }, []);

    res.json(formattedAppointments);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch Data", error: error.message });
  }
}

async function getTopRatedDoctors(req, res) {
  try {
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Doctors");

    // Fetch doctors with a rating and sort them by rating in descending order
    const doctors = await collection
      .find({ rating: { $ne: null } })
      .sort({ rating: -1 })
      .toArray();

    res.json(doctors);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch top-rated doctors",
      error: error.message,
    });
  }
}

async function Dashboard(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ status: "error", message: "Doctor ID is required" });
    return;
  }
  try {
    await connectToDatabase();
    const db = client.db("ImmunePlus");
    const collection = db.collection("doctoravailabilities");

    const data = await collection.find({ doctorId: parseInt(id) }).toArray();

    const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format

    const stats = data.reduce(
      (acc, appointment) => {
        // Ensure date is in string format

        const appointmentDate = new Date(appointment.date)
          .toISOString()
          .split("T")[0]; // Extract date in YYYY-MM-DD format

        acc.totalAppointments +=
          appointment.bookedClinic + appointment.bookedVideo;
        acc.totalClinicBookings += appointment.bookedClinic;
        acc.totalVideoBookings += appointment.bookedVideo;

        if (appointmentDate === today) {
          acc.totalAppointmentsToday +=
            appointment.bookedClinic + appointment.bookedVideo;
        }

        return acc;
      },
      {
        totalAppointments: 0,
        totalAppointmentsToday: 0,
        totalClinicBookings: 0,
        totalVideoBookings: 0,
      }
    );

    res.json(stats);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch data", error: error.message });
  }
}

async function searchDoctors(req, res) {
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Doctors");

    // Extract the keyword from the request body
    const { keyword } = req.body;

    if (!keyword) {
      return res.status(400).json({
        status: "error",
        message: "Keyword is required for search",
      });
    }

    // Define type mapping with partial matching
    const typeMapping = {
      homeopathy: 1,
      allopathy: 2,
      ayurveda: 3,
    };

    // Find if the keyword matches or is a part of any specific types
    let matchedType = null;
    for (const key in typeMapping) {
      if (key.includes(keyword.toLowerCase())) {
        matchedType = typeMapping[key];
        break;
      }
    }

    // Build the search query
    const searchQuery = {
      $or: [
        { name: { $regex: keyword, $options: "i" } },
        { hospital: { $regex: keyword, $options: "i" } },
        { specialist: { $regex: keyword, $options: "i" } },
        { location: { $regex: keyword, $options: "i" } },
        { experience: { $regex: keyword, $options: "i" } },
        { rating: { $regex: keyword, $options: "i" } },
      ],
    };

    // If a type match was found, add it to the search query
    if (matchedType !== null) {
      searchQuery.$or.push({ type: matchedType });
    }

    // Execute the search
    const doctors = await collection.find(searchQuery).toArray();

    if (doctors.length > 0) {
      res.status(200).json({
        status: "success",
        data: doctors,
      });
    } else {
      res.status(404).json({
        status: "error",
        message: "No doctors found matching the keyword",
      });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "An error occurred during the search",
      reason: error.message,
    });
  } finally {
    //await client.close();
  }
}
async function searchFilterDoctors(req, res) {
  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const doctorsCollection = db.collection("Doctors");
    const availabilitiesCollection = db.collection("doctoravailabilities");

    // Extract filters from the request body
    const { keyword, treatmentType, specialist, filterDate, time } = req.body;

    if (!keyword) {
      return res.status(400).json({
        status: "error",
        message: "Keyword is required for search",
      });
    }

    // Define type mapping with partial matching
    const typeMapping = {
      homeopathy: 1,
      allopathy: 2,
      ayurveda: 3,
    };

    // Find if the keyword matches or is a part of any specific types
    let matchedType = null;
    for (const key in typeMapping) {
      if (key.includes(keyword.toLowerCase())) {
        matchedType = typeMapping[key];
        break;
      }
    }

    // Build the initial search query with keyword
    const searchQuery = {
      $or: [
        { name: { $regex: keyword, $options: "i" } },
        { hospital: { $regex: keyword, $options: "i" } },
        { specialist: { $regex: keyword, $options: "i" } },
        { location: { $regex: keyword, $options: "i" } },
        { experience: { $regex: keyword, $options: "i" } },
        { rating: { $regex: keyword, $options: "i" } },
      ],
    };

    // If a type match was found, add it to the search query
    if (matchedType !== null) {
      searchQuery.$or.push({ type: matchedType });
    }

    // Build the filter object
    let filters = {};
    if (treatmentType && treatmentType !== "0") {
      filters.type = parseInt(treatmentType);
    }
    if (specialist && specialist !== "0") {
      filters.specialist = { $regex: specialist, $options: "i" };
    }

    // Aggregate to join Doctors with doctoravailabilities and apply date/time filters
    const pipeline = [
      {
        $match: searchQuery, // Apply initial search filters
      },
      {
        $lookup: {
          from: 'doctoravailabilities', // Name of the schedule collection
          localField: '_id', // Doctor's _id field
          foreignField: 'doctorId', // doctorId in schedule
          as: 'schedules', // Alias for the joined data
        },
      },
      {
        $addFields: {
          schedules: {
            $filter: {
              input: '$schedules',
              as: 'schedule',
              cond: {
                $and: [
                  filterDate && filterDate !== '0'
                    ? { $eq: [{ $toDate: '$$schedule.date' }, new Date(filterDate)] } // Match by date
                    : { $literal: true },
                  time && time !== '0'
                    ? { $eq: ['$$schedule.time', time] } // Match by time
                    : { $literal: true },
                ],
              },
            },
          },
        },
      },
      {
        $match: {
          'schedules.0': { $exists: true }, // Ensure at least one matching schedule exists
        },
      },
    ];

    // Execute the aggregation pipeline
    const doctors = await doctorsCollection.aggregate(pipeline).toArray();

    if (doctors.length > 0) {
      res.status(200).json({
        status: 'success',
        data: doctors,
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: 'No doctors found matching the criteria',
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during the search',
      reason: error.message,
    });
  } finally {
    // await client.close();
  }
}



module.exports = {
  loginDoctor,
  registerDoctor,
  updateDoctor,
  deleteDoctor,
  getAll,
  getAllAvailableDocter,
  getDocterbyId,
  bookAppointment,
  getScheduleByScheduleId,
  createSchedule,
  filterSchedules,
  upload,
  getTopRatedDoctors,
  getSchedulebyId,
  getAppointmentbyId,
  Dashboard,
  updateTotalSlots,
  deleteSchedule,
  getBookingById,
  getSchedulebyIdDetails,
  searchDoctors,
  searchFilterDoctors
};
