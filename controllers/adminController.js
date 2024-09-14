const AgeGroup = require('../models/AgeGroup');
const { MongoClient, ServerApiVersion } = require('mongodb');

const client = new MongoClient(process.env.UU, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Controller function to create a new age group
async function changeDocter(req, res) {
  try {
    const { id, isApproved, } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("Doctors");

    let updateFields = { isApproved };

    const result = await collection.updateOne(
      { _id: parseInt(id) },
      { $set: updateFields }
    );

    if (result.modifiedCount === 1) {
      // Send success response
      res.status(200).json({ status: "success", message: "Status Updated" });
    } else {
      res
        .status(400)
        .json({ status: "error", message: "Status update failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update status", error: error.message });
  }
}

async function changeDeliveryPartner(req, res) {
  try {
    const { id, isApproved, } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("DeliveryPartner");

    let updateFields = { isApproved };

    const result = await collection.updateOne(
      { _id: parseInt(id) },
      { $set: updateFields }
    );

    if (result.modifiedCount === 1) {
      // Send success response
      res.status(200).json({ status: "success", message: "Status Updated" });
    } else {
      res
        .status(400)
        .json({ status: "error", message: "Status update failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update status", error: error.message });
  }
}

async function changePharmacy(req, res) {
  try {
    const { id, isApproved, } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("Pharmacy");

    let updateFields = { isApproved };

    const result = await collection.updateOne(
      { _id: parseInt(id) },
      { $set: updateFields }
    );

    if (result.modifiedCount === 1) {
      // Send success response
      res.status(200).json({ status: "success", message: "Status Updated" });
    } else {
      res
        .status(400)
        .json({ status: "error", message: "Status update failed" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update status", error: error.message });
  }
}

async function login(req, res) {
  const { username, password } = req.body;
  let validations = [];

  if (!password) validations.push({ key: 'password', message: 'Password is required' });
  if (!username) validations.push({ key: 'username', message: 'Username is required' });


  if (validations.length) {
    res.status(400).json({ status: 'error', validations: validations });
    return;
  }

  try {
    await client.connect();
    const db = client.db("ImmunePlus");
    const collection = db.collection("Admin");
    const user = await collection.findOne({ username: username, password: password });

    if (user) {
      res.json({ status: 'success', message: 'Login successfull!' });
    } else {
      res.status(400).json({ status: 'error', message: 'Invalid Username or password' });
    }
  } finally {
    //await client.close();
  }
}

async function getPendingRequests(req, res) {
  try {
    await client.connect();
    const db = client.db("ImmunePlus");

    // Fetch pending doctor requests
    const doctorsCollection = db.collection("Doctors");
    const pendingDoctors = await doctorsCollection.find({ isApproved: { $in: [0] } }).toArray();

    // Fetch pending delivery partner requests
    const deliveryPartnerCollection = db.collection("DeliveryPartner");
    const pendingDeliveryPartners = await deliveryPartnerCollection.find({ isApproved: { $in: [0] } }).toArray();

    // Fetch pending pharmacy requests
    const pharmacyCollection = db.collection("Pharmacy");
    const pendingPharmacies = await pharmacyCollection.find({ isApproved: { $in: [0] } }).toArray();

    // Combine all pending requests into a single response
    const pendingRequests = {
      doctors: pendingDoctors,
      deliverypartners: pendingDeliveryPartners,
      pharmacies: pendingPharmacies,
    };

    res.status(200).json(pendingRequests);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pending requests", error: error.message });
  }
}



module.exports = {
  changeDocter,
  changePharmacy,
  changeDeliveryPartner,
  login,
  getPendingRequests
};
