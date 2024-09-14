const bcrypt = require('bcrypt');
const { MongoClient, ServerApiVersion } = require('mongodb');
const User = require('../models/User');
const url = 'mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/?retryWrites=true&w=majority&appName=ImmunePlus';
const client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// User login controller
async function loginUser(req, res) {
    const { phoneNumber, password } = req.body;
    let validations = [];
    let phoneNumMessage = '';

    if (!password) validations.push({ key: 'password', message: 'Password is required' });
    if (phoneNumber) {
        if (phoneNumber.length < 10 || phoneNumber.length > 10) {
            phoneNumMessage = 'Phone Number should habe 10 digits.';
        }
    } else {
        phoneNumMessage = 'Phone Number is required.';
    }
    if (phoneNumMessage) {
        validations.push({ key: 'Phone Number', message: phoneNumMessage });
    }


    if (validations.length) {
        res.status(400).json({ status: 'error', validations: validations });
        return;
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Users");
        const user = await collection.findOne({ phoneNumber: phoneNumber });

        if (user) {
            const result = await bcrypt.compare(password, user.password);
            if (result) {
                const userInfo = {
                    fullName: user.fullName,
                    userId: user.userId,
                    gender: user.gender,
                    address: user.address,
                    state: user.state,
                    ageGroup: user.ageGroup,
                    email: user.email,
                    pincode: user.pincode,
                    phoneNumber: user.phoneNumber,
                    previousHistory: user.previousHistory
                };

                res.json({ status: 'success', message: 'Login successfull!', user: userInfo });
            } else {
                res.status(400).json({ status: 'error', message: 'Invalid Phone Number or password' });
            }
        } else {
            res.status(400).json({ status: 'error', message: 'Invalid email or password' });
        }
    } finally {
        await client.close();
    }
}

// User registration controller
async function registerUser(req, res) {
    const { password, address, fullName, ageGroup, email, gender, state, pincode, phoneNumber, previousHistory } = req.body;
    let validations = [];
    let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;
    let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    

    let passwordMessage = '';
    let phoneNumMessage = '';

    if (phoneNumber) {
        if (phoneNumber.length < 10 || phoneNumber.length > 10) {
            phoneNumMessage = 'Phone Number should habe 10 digits.';
        }
    } else {
        phoneNumMessage = 'Phone Number is required.';
    }
    if (phoneNumMessage) {
        validations.push({ key: 'Phone Number', message: phoneNumMessage });
    }

    if (password) {
        if (password.length < 8 || password.length > 20) {
            passwordMessage = 'Password should be between 8 to 20 characters.';
        } else {
            if (!regex.test(password)) {
                passwordMessage = 'Password should contain at least one number, one special character, and one uppercase letter.';
            }
        }
    } else {
        passwordMessage = 'Password is required.';
    }


    if (passwordMessage) {
        validations.push({ key: 'password', message: passwordMessage });
    }

    if (!address) validations.push({ key: 'address', message: 'Address is required' });
    if (!fullName) validations.push({ key: 'fullName', message: 'Full name is required' });
    if (!email) validations.push({ key: 'email', message: 'Email is required' });
    else if (!emailRegex.test(email)) validations.push({ key: 'email', message: 'Email is not valid' });
    if (!gender) validations.push({ key: 'gender', message: 'Gender is required' });
    if (!state) validations.push({ key: 'state', message: 'State is required' });
    if (!pincode) validations.push({ key: 'pincode', message: 'Pincode is required' });
    if (!phoneNumber) validations.push({ key: 'phoneNumber', message: 'Phone number is required' });
    if (!ageGroup) validations.push({ key: 'ageGroup', message: 'Age Group is required' });


    if (validations.length) {
        res.status(400).json({ status: 'error', validations: validations });
        return;
    }

    try {

        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Users");
        const countersCollection = db.collection("Counters");

        const existingUser = await collection.findOne({ phoneNumber });

        if (existingUser) {
            res.status(400).json({ status: 'error', message: 'Phone Number already exists' });
        } else {
            const hashedPassword = await bcrypt.hash(password, 10);

            const counter = await countersCollection.findOneAndUpdate(
                { _id: "userId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            const newId = counter.seq;

            const result = await collection.insertOne({
                password: hashedPassword,
                address,
                fullName,
                ageGroup,
                email,
                gender,
                state,
                pincode,
                phoneNumber,
                previousHistory,
                _id: newId
            });
           
            console.log(result);
            if (result.acknowledged === true) {
                return res.status(200).json({ status: 'success', message: 'User registered successfully' });
            } else {
                res.status(400).json({ status: 'error', message: 'Registration failed' });
            }
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during registration', reason: error });
    } finally {
        await client.close();
    }
}

async function updateUser(req, res) {
    const { userId, password, address, fullName, ageGroup, email, gender, state, pincode, phoneNumber, previousHistory } = req.body;
    let validations = [];
    let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;
    let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!userId) validations.push({ key: 'userId', message: 'User ID is required' });

    if (password && (password.length < 8 || password.length > 20 || !regex.test(password))) {
        validations.push({ key: 'password', message: 'Password should be between 8 to 20 characters, contain at least one number, one special character, and one uppercase letter.' });
    }

    if (email && !emailRegex.test(email)) validations.push({ key: 'email', message: 'Email is not valid' });

    if (validations.length) {
        res.status(400).json({ status: 'error', validations: validations });
        return;
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Users");

        const user = await collection.findOne({ userId });

        if (!user) {
            res.status(400).json({ status: 'error', message: 'User not found' });
            return;
        }

        const updatedFields = {};
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updatedFields.password = hashedPassword;
        }
        if (address) updatedFields.address = address;
        if (fullName) updatedFields.fullName = fullName;
        if (ageGroup) updatedFields.ageGroup = ageGroup;
        if (email) updatedFields.email = email;
        if (gender) updatedFields.gender = gender;
        if (state) updatedFields.state = state;
        if (pincode) updatedFields.pincode = pincode;
        if (phoneNumber) updatedFields.phoneNumber = phoneNumber;
        if (previousHistory) updatedFields.previousHistory = previousHistory;

        const result = await collection.updateOne({ userId }, { $set: updatedFields });

        if (result.modifiedCount > 0) {
            res.status(200).json({ status: 'success', message: 'User updated successfully' });
        } else {
            res.status(400).json({ status: 'error', message: 'Failed to update user' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during update', reason: error });
    } finally {
        await client.close();
    }
}

// Delete user controller
async function deleteUser(req, res) {
    const { userId } = req.body;

    if (!userId) {
        res.status(400).json({ status: 'error', message: 'User ID is required' });
        return;
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Users");

        const user = await collection.findOne({ userId });

        if (!user) {
            res.status(400).json({ status: 'error', message: 'User not found' });
            return;
        }

        const result = await collection.deleteOne({ userId });

        if (result.deletedCount > 0) {
            res.status(200).json({ status: 'success', message: 'User deleted successfully' });
        } else {
            res.status(400).json({ status: 'error', message: 'Failed to delete user' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during deletion', reason: error });
    } finally {
        await client.close();
    }
}

async function getAll(req, res) {
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("Users");
        
        const users = await collection.find().toArray();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch userss', error: error.message });
    }
}

module.exports = {
    loginUser,
    registerUser,
    updateUser,
    deleteUser,
    getAll
};
