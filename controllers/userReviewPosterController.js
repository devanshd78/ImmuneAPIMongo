const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');


const client = new MongoClient(process.env.UU, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let isConnected = false;

async function connectToDatabase() {
    if (!isConnected) {
        try {
            await client.connect();
            isConnected = true;
            console.log('Connected to the database');
        } catch (err) {
            console.error('Failed to connect to the database', err);
            throw err;
        }
    }
}

// Multer configuration for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

async function create(req, res) {
    try {
        await connectToDatabase();
        const { name, description, date } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("CommentPoster");
        const countersCollection = db.collection("Counters");

        let validations = [];

        if (!description) validations.push({ key: 'description', message: 'Description is required' });
        if (!name) validations.push({ key: 'name', message: 'Name is required' });
        if (!date) validations.push({ key: 'date', message: 'Date is required' });
        if (!req.file || !req.file.buffer) validations.push({ key: 'img', message: 'Image is required' });

        let existing = await collection.findOne({ name });

        if (validations.length) {
            res.status(400).json({ status: 'error', validations: validations });
            return;
        }

        if (existing) {
            res.status(400).json({ status: 'error', message: 'Poster already exists' });
        } else {
            // Get and increment the counter for posterId
            const counter = await countersCollection.findOneAndUpdate(
                { _id: "posterId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );

            const newId = counter.seq;
            const filePath = path.join('uploads/poster/comment', `${newId}.png`);
            if (!fs.existsSync('uploads/poster/comment')) {
                fs.mkdirSync('uploads/poster/comment', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);

            const result = await collection.insertOne({
                _id: newId,
                name,
                description,
                img: filePath,
                date
            });

            if (result.acknowledged === true) {
                return res.status(200).json({ status: 'success', message: 'Poster Saved' });
            } else {
                res.status(400).json({ status: 'error', message: 'Creation failed' });
            }
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to create Poster', error: error.message });
    }
}

async function getAllPosters(req, res) {
    try {
        await connectToDatabase();
        const db = client.db("ImmunePlus");
        const collection = db.collection("CommentPoster");
        const categories = await collection.find().toArray();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch Poster', error: error.message });
    }
}

async function update(req, res) {
    try {
        await connectToDatabase();
        const { id, name, description, date } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("CommentPoster");

        let updateFields = { name, description, date };
        // let existing = await collection.findOne({ name });


        if (req.file && req.file.buffer) {
            const filePath = path.join('uploads/poster/comment', `${id}.png`);
            if (!fs.existsSync('uploads/poster/comment')) {
                fs.mkdirSync('uploads/poster/comment', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);
            updateFields.img = filePath;
        }

        const result = await collection.updateOne(
            { _id: parseInt(id) },
            { $set: updateFields }
        );

        if (result.modifiedCount === 1) {
            res.status(200).json({ status: 'success', message: 'Poster Updated' });
        } else {
            res.status(400).json({ status: 'error', message: 'Update failed' });
        }

    } catch (error) {
        res.status(500).json({ message: 'Failed to update Poster', error: error.message });
    }
}

async function remove(req, res) {
    try {
        await connectToDatabase();
        const { id } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("CommentPoster");

        const result = await collection.deleteOne({ _id: parseInt(id) });

        if (result.deletedCount > 0) {
            res.status(200).json({ status: 'success', message: 'Poster Deleted' });
        } else {
            res.status(400).json({ status: 'error', message: 'Delete failed' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete Poster', error: error.message });
    }
}

module.exports = {
    create,
    getAllPosters,
    upload,
    update,
    remove
};
