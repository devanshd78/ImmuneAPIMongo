const { MongoClient, ServerApiVersion } = require('mongodb');

const client = new MongoClient(process.env.UU, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Controller function to create a new Payment
// Controller function to create a new Payment
async function createPayment(req, res) {
    const { userId, orderId, totalPrice, type, PartnerId, status } = req.body;

    // Array to store validation errors
    const validations = [];

    // Validate required fields
    if (!userId) validations.push({ key: 'userId', message: 'User ID is required' });
    if (!orderId) validations.push({ key: 'orderId', message: 'Order ID is required' });
    if (!totalPrice) validations.push({ key: 'totalPrice', message: 'Total price is required' });
    if (typeof type === 'undefined') validations.push({ key: 'type', message: 'Type is required' }); // Ensure type is not undefined

    if (typeof status === 'undefined') validations.push({ key: 'status', message: 'Status is required' }); // Ensure status is not undefined

    // If there are validation errors, return them to the client
    if (validations.length > 0) {
        return res.status(400).json({ status: 'error', validations });
    }

    // If no validation errors, proceed with payment creation
    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const paymentCollection = db.collection("paymentDelivery");

        // Generate new payment ID
        const counter = await db.collection("Counters").findOneAndUpdate(
            { _id: "paymentId" },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: 'after' }
        );
        const newPaymentId = counter.seq;
        let amountToBePaid = totalPrice - (totalPrice * 15) / 100;
        const dateInIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        const paymentInfo = {
            _id: newPaymentId,
            userId: parseInt(userId),
            orderId: parseInt(orderId),
            totalPrice: parseFloat(totalPrice),
            type: 3,
            date: dateInIST,
            PartnerId: PartnerId ? parseInt(PartnerId) : null,
            status: parseInt(status),
            amountToBePaid: amountToBePaid
        };

        const result = await paymentCollection.insertOne(paymentInfo);

        if (result.acknowledged) {
            res.status(200).json({ status: 'success', message: 'Payment created successfully', paymentId: newPaymentId });
        } else {
            throw new Error('Failed to create payment');
        }
    } catch (error) {
        console.error("Error creating payment:", error);
        res.status(500).json({ status: 'error', message: 'An error occurred while creating the payment', reason: error.message });
    }
}


// Controller function to get all Payments
async function getAllPayments(req, res) {
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("paymentDelivery");

        const Payments = await collection.find().toArray();
        res.json(Payments);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch Payments', error: error.message });
    }
}

async function update(req, res) {
    try {
        // Ensure the client is connected

        const { userId, orderId, totalPrice, type, PartnerId, status, id } = req.body;

        // Array to store validation errors
        const validations = [];

        // Validate required fields
        if (!userId) validations.push({ key: 'userId', message: 'User ID is required' });
        if (!id) validations.push({ key: 'paymentId', message: 'Payment ID is required' });
        if (!orderId) validations.push({ key: 'orderId', message: 'Order ID is required' });
        if (!totalPrice) validations.push({ key: 'totalPrice', message: 'Total price is required' });
        if (typeof type === 'undefined') validations.push({ key: 'type', message: 'Type is required' }); // Ensure type is not undefined

        if (typeof status === 'undefined') validations.push({ key: 'status', message: 'Status is required' });

        // If there are validation errors, return them to the client
        if (validations.length > 0) {
            return res.status(400).json({ status: 'error', validations });
        }

        const db = client.db("ImmunePlus");
        const collection = db.collection("paymentDelivery");

        let updateFields = { userId, orderId, totalPrice, type, PartnerId, status };

        const result = await collection.updateOne(
            { _id: parseInt(id) },
            { $set: updateFields }
        );

        if (result.modifiedCount === 1) {
            res.status(200).json({ status: 'success', message: 'Payment Updated' });
        } else {
            res.status(400).json({ status: 'error', message: 'Update failed' });
        }

    } catch (error) {
        res.status(500).json({ message: 'Failed to update Payment', error: error.message });
    }
}

// Controller function to delete a TypeOfTreatment
async function remove(req, res) {
    try {
        const { id } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("paymentDelivery");

        const result = await collection.deleteOne({ _id: parseInt(id) });
        if (result.deletedCount > 0) {
            res.status(200).json({ status: 'success', message: 'Payment Deleted' });
        } else {
            res.status(400).json({ status: 'error', message: 'Delete failed' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete Payment', error: error });
    }
}

module.exports = {
    createPayment,
    getAllPayments,
    update,
    remove
};
