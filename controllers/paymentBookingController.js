const { MongoClient, ServerApiVersion } = require('mongodb');

const client = new MongoClient(process.env.UU, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Controller function to create a new Payment
async function createPayment(req, res) {
    const { bookingId, userId, doctorId, date, time, type, status, totalAmount, amountToBePaid } = req.body;

    const validations = [];

    // Validate required fields
    if (!bookingId) validations.push({ key: 'bookingId', message: 'Booking ID is required' });
    if (!userId) validations.push({ key: 'userId', message: 'User ID is required' });
    if (!doctorId) validations.push({ key: 'doctorId', message: 'Doctor ID is required' });
    if (!date) validations.push({ key: 'date', message: 'Date is required' });
    if (!time) validations.push({ key: 'time', message: 'Time is required' });
    if (typeof type === 'undefined') validations.push({ key: 'type', message: 'Type is required' }); // Ensure type is not undefined
    if (typeof status === 'undefined') validations.push({ key: 'status', message: 'Status is required' }); // Ensure status is not undefined
    if (!totalAmount) validations.push({ key: 'totalAmount', message: 'Total amount is required' });
    if (!amountToBePaid) validations.push({ key: 'amountToBePaid', message: 'Amount to be paid is required' });

    // If there are validation errors, return them to the client
    if (validations.length > 0) {
        return res.status(400).json({ status: 'error', validations });
    }
    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const paymentCollection = db.collection("paymentDocter");
        const countersCollection = db.collection("Counters");

        // Generate new payment ID
        const counter = await countersCollection.findOneAndUpdate(
            { _id: "paymentId" },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: 'after' }
        );
        const newPaymentId = counter.seq;
        const dateInIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        const paymentInfo = {
            _id: newPaymentId,
            bookingId: parseInt(bookingId),
            userId: parseInt(userId),
            doctorId: parseInt(doctorId),
            date: new Date(date),
            time,
            type: parseInt(type),
            createdAt: dateInIST,
            status: parseInt(status),
            totalAmount: parseFloat(totalAmount),
            amountToBePaid: parseFloat(amountToBePaid)
        };

        const result = await paymentCollection.insertOne(paymentInfo);

        if (result.acknowledged) {
            res.status(200).json({ status: 'success', message: 'Payment created successfully', paymentId: newPaymentId });
        } else {
            throw new Error('Failed to create payment');
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred while creating the payment', reason: error.message });
    } finally {
        // await client.close();
    }
}

// Controller function to get all Payments
async function getAllPayments(req, res) {
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("paymentDocter");

        const Payments = await collection.find().toArray();
        res.json(Payments);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch Payments', error: error.message });
    }
}

async function update(req, res) {
    try {
        // Ensure the client is connected

        const { id, bookingId, userId, doctorId, date, time, type, status, totalAmount, amountToBePaid } = req.body;

        const validations = [];

        // Validate required fields
        if (!bookingId) validations.push({ key: 'bookingId', message: 'Booking ID is required' });
        if (!id) validations.push({ key: 'PaymentId', message: 'Payment ID is required' });
        if (!userId) validations.push({ key: 'userId', message: 'User ID is required' });
        if (!doctorId) validations.push({ key: 'doctorId', message: 'Doctor ID is required' });
        if (!date) validations.push({ key: 'date', message: 'Date is required' });
        if (!time) validations.push({ key: 'time', message: 'Time is required' });
        if (typeof type === 'undefined') validations.push({ key: 'type', message: 'Type is required' }); // Ensure type is not undefined
        if (typeof status === 'undefined') validations.push({ key: 'status', message: 'Status is required' }); // Ensure status is not undefined
        if (!totalAmount) validations.push({ key: 'totalAmount', message: 'Total amount is required' });
        if (!amountToBePaid) validations.push({ key: 'amountToBePaid', message: 'Amount to be paid is required' });

        // If there are validation errors, return them to the client
        if (validations.length > 0) {
            return res.status(400).json({ status: 'error', validations });
        }

        const db = client.db("ImmunePlus");
        const collection = db.collection("paymentDocter");

        let updateFields = { bookingId, userId, doctorId, date, time, type, status, totalAmount, amountToBePaid };


        let existing = await collection.findOne({ bookingId, userId, doctorId, date, time, type, status, totalAmount, amountToBePaid });

        if (existing) {
            res.status(400).json({ status: 'error', message: 'Payment already exists' });
        } else {


            const result = await collection.updateOne(
                { _id: parseInt(id) },
                { $set: updateFields }
            );

            if (result.modifiedCount === 1) {
                res.status(200).json({ status: 'success', message: 'Payment Updated' });
            } else {
                res.status(400).json({ status: 'error', message: 'Update failed' });
            }
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
        const collection = db.collection("paymentDocter");

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
