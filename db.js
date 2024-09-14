// db.js
const { MongoClient, ServerApiVersion } = require('mongodb');

const url = 'mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/?retryWrites=true&w=majority&appName=ImmunePlus';
const client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function connectToDatabase() {
    if (!client.isConnected()) {
        await client.connect();
    }
    return client.db('ImmunePlus');
}

module.exports = {
    connectToDatabase,
    client
};
