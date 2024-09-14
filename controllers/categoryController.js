const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');
const url = 'mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/?retryWrites=true&w=majority&appName=ImmunePlus';

const client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Multer configuration for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

async function create(req, res) {
    try {
        await client.connect();
        const { name, description } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("Category");
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
            res.status(400).json({ status: 'error', message: 'Category already exists' });
        } else {
            const filePath = path.join('uploads/category', req.file.originalname);
            if (!fs.existsSync('uploads/category')) {
                fs.mkdirSync('uploads/treatment', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);

            // Get and increment the counter for TypeOfTreatment
            const counter = await countersCollection.findOneAndUpdate(
                { _id: "categoryId" },
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
                return res.status(200).json({ status: 'success', message: 'Category Saved' });
            } else {
                res.status(400).json({ status: 'error', message: 'Creation failed' });
            }
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to create Category', error: error.message });
    }
}

async function getAllCategories(req, res) {
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("Category");

        const categories = await collection.find().toArray();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
    }
}

async function update(req, res) {
    try {
 // Ensure the client is connected

        const { id,  name, description } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("Category");

        let updateFields = {  name, description };
        let existing = await collection.findOne({ name });

        if (existing) {
            res.status(400).json({ status: 'error', message: 'Category already exists' });
        } else {

        if (req.file && req.file.buffer) {
            const filePath = path.join('uploads/category', req.file.originalname);
            if (!fs.existsSync('uploads/category')) {
                fs.mkdirSync('uploads/category', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);
            updateFields.img = filePath;
        }

        const result = await collection.updateOne(
            { _id: parseInt(id) },
            { $set: updateFields }
        );

        if (result.modifiedCount === 1) {
            res.status(200).json({ status: 'success', message: 'Category Updated' });
        } else {
            res.status(400).json({ status: 'error', message: 'Update failed' });
        }
    }
    } catch (error) {
        res.status(500).json({ message: 'Failed to update Category', error: error.message });
    }
}

// Controller function to delete a TypeOfTreatment
async function remove(req, res) {
    try {
        const { id } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("Category");

        const user = await collection.findOne({ _id: parseInt(id) });
        console.log(user);
        const result = await collection.deleteOne({ _id: parseInt(id) });
        console.log(result);
        if (result.deletedCount> 0) {
            res.status(200).json({ status: 'success', message: 'Category Deleted' });
        } else {
            res.status(400).json({ status: 'error', message: 'Delete failed'  });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete Category', error: error });
    }
}

module.exports = {
    create,
    getAllCategories,
    upload,
    update,
    remove
};
