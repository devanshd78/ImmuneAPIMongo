
const { MongoClient, ServerApiVersion } = require('mongodb');
const url = 'mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/?retryWrites=true&w=majority&appName=ImmunePlus';
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { error } = require('console');
const client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
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
       
        if (!description) validations.push({ key: 'description', message: 'Description is required' });
        if (!name) validations.push({ key: 'name', message: 'Name is required' });
        if (!req.file || !req.file.buffer) validations.push({ key: 'img', message: 'Image is required' });

        let existing = await collection.findOne({ name });

        if (validations.length) {
            res.status(400).json({ status: 'error', validations: validations });
            return;
        }

        if (existing) {
            res.status(400).json({ status: 'error', message: 'Type Of Treatment already exists' });
        } else {
            const filePath = path.join('uploads/treatment', req.file.originalname);
            if (!fs.existsSync('uploads/treatment')) {
                fs.mkdirSync('uploads/treatment', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);

            // Get and increment the counter for TypeOfTreatment
            const counter = await countersCollection.findOneAndUpdate(
                { _id: "typeOfTreatmentId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            const newId = counter.seq;
         
            const result = await collection.insertOne({
                _id: newId,
                name,
                description,
                img: filePath
            });

            if (result.acknowledged === true) {
                return res.status(200).json({ status: 'success', message: 'TypeOfTreatment Saved' });
            } else {
                res.status(400).json({ status: 'error', message: 'Registration failed' });
            }
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to create TypeOfTreatment', error: error.message });
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
        res.status(500).json({ message: 'Failed to fetch TypeOfTreatments', error: error.message });
    }
}

async function update(req, res) {
    try {
 // Ensure the client is connected

        const { id,  name, description } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("TypeOfTreatment");

        let updateFields = {  name, description };

        
        let existing = await collection.findOne({ name });

        if (existing) {
            res.status(400).json({ status: 'error', message: 'Type Of Treatment already exists' });
        } else {
        if (req.file && req.file.buffer) {
            const filePath = path.join('uploads/treatment', req.file.originalname);
            if (!fs.existsSync('uploads/treatment')) {
                fs.mkdirSync('uploads/treatment', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);
            updateFields.img = filePath;
        }

        const result = await collection.updateOne(
            { _id: parseInt(id) },
            { $set: updateFields }
        );

        if (result.modifiedCount === 1) {
            res.status(200).json({ status: 'success', message: 'TypeOfTreatment Updated' });
        } else {
            res.status(400).json({ status: 'error', message: 'Update failed' });
        }
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to update TypeOfTreatment', error: error.message });
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
        if (result.deletedCount> 0) {
            res.status(200).json({ status: 'success', message: 'TypeOfTreatment Deleted' });
        } else {
            res.status(400).json({ status: 'error', message: 'Delete failed'  });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete TypeOfTreatment', error: error });
    }
}




module.exports = {
    create,
    getAll,
    upload,
    update,
    remove
};
