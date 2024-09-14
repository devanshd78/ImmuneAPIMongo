const bcrypt = require('bcrypt');
const { MongoClient, ServerApiVersion } = require('mongodb');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const DoctorAvailability = require('../models/Availability');
const Appointment = require('../models/Appointments')
const url = 'mongodb+srv://rsrisabhsingh212:Immuneplus123@immuneplus.v6jufn0.mongodb.net/?retryWrites=true&w=majority&appName=ImmunePlus';
const client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

const mongoose = require('mongoose');

async function createAvailabilitySchedule(doctorId, workingDays, workingHours, availableSlots) {
    const today = new Date();
    const dayMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const schedules = [];

    const db = mongoose.connection;
    const countersCollection = db.collection("Counters");

    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dayOfWeek = date.getDay();

        if (workingDays.includes(dayOfWeek)) {
            const weekday = dayMap[dayOfWeek];

            for (const hour of workingHours) {
                const timeSlot = `${hour}:00`;
                const slotsForTheDay = availableSlots[workingHours.indexOf(hour)] || 0;
                const existingSchedule = await DoctorAvailability.findOne({ doctorId, date, time: timeSlot });

                if (existingSchedule) {
                    await DoctorAvailability.updateOne(
                        { _id: existingSchedule._id },
                        { $inc: { bookings: 1 } }
                    );
                } else {
                    // Generate a custom ID based on the availability counter
                    const counterAvailable = await countersCollection.findOneAndUpdate(
                        { _id: "availableId" },
                        { $inc: { seq: 1 } },
                        { upsert: true, returnDocument: 'after' }
                    );

                    const newId = counterAvailable.seq.toString(16).padStart(24, '0'); // Convert to hex string

                    schedules.push({
                        _id: new mongoose.Types.ObjectId(newId), // Set custom ObjectId
                        doctorId,
                        date,
                        weekday,
                        time: timeSlot,
                        availableSlots: slotsForTheDay,
                        bookings: 0  // Start with 0 bookings
                    });
                }
            }
        }
    }

    await DoctorAvailability.insertMany(schedules);
}
async function bookAppointment(req, res) {
    const { doctorId, date, time, patientId } = req.body;

    if (!doctorId || !date || !time || !patientId) {
        return res.status(400).json({ status: 'error', message: 'Doctor ID, date, time, and patient ID are required' });
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("doctoravailabilities");

        const appointmentDate = new Date(date);
        const timeSlot = `${time}:00`;

        // Find the availability schedule for the given doctor, date, and time
        const availability = await collection.findOne({
            doctorId,
            date: appointmentDate,
            time: timeSlot
        });

        if (!availability) {
            return res.status(404).json({ status: 'error', message: 'No availability found for the given date and time' });
        }

        if (availability.availableSlots > 0) {
            // Decrement the available slots and increment the bookings
            await collection.updateOne(
                { _id: availability._id },
                { $inc: { availableSlots: -1, bookings: 1 } }
            );

            // Insert the appointment record
            const newAppointment = new Appointment({
                doctorId,
                date: appointmentDate,
                time: timeSlot,
                patientId
            });

            await newAppointment.save();

            res.status(200).json({ status: 'success', message: 'Appointment booked successfully' });
        } else {
            res.status(400).json({ status: 'error', message: 'No available slots for the given date and time' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during booking', reason: error.message });
    } finally {
        await client.close();
    }
}



async function registerDoctor(req, res) {
    const { name, hospital, about, type, patients, experience, rating, workinghours, availableSlots, location, specialist, workingDays, videoFee, appointmentFee, email, password } = req.body;
    let validations = [];
    let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;
    let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    let passwordMessage = '';

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

    if (!password) validations.push({ key: 'password', message: 'Password is required' });
    if (!req.file || !req.file.buffer) validations.push({ key: 'img', message: 'Image is required' });
    if (!email) validations.push({ key: 'email', message: 'Email is required' });
    else if (!emailRegex.test(email)) validations.push({ key: 'email', message: 'Email is not valid' });
    if (!name) validations.push({ key: 'name', message: 'Name is required' });
    if (!hospital) validations.push({ key: 'hospital', message: 'Hospital is required' });
    if (!about) validations.push({ key: 'about', message: 'About is required' });
    if (!type) validations.push({ key: 'type', message: 'Type is required' });
    if (!patients) validations.push({ key: 'patients', message: 'Patients is required' });
    if (!experience) validations.push({ key: 'experience', message: 'Experience is required' });
    if (!workinghours) validations.push({ key: 'workinghours', message: 'Working Hours is required' });
    if (!availableSlots) validations.push({ key: 'availableSlots', message: 'Available Slots is required' });
    if (!specialist) validations.push({ key: 'specialist', message: 'specialist is required' });
    if (!workingDays) validations.push({ key: 'workingDays', message: 'Working Days is required' });
    if (!videoFee) validations.push({ key: 'videoFee', message: 'Video Fee is required' });
    if (!appointmentFee) validations.push({ key: 'appointmentFee', message: 'Appointment Fee is required' });
    if (!location) validations.push({ key: 'location', message: 'Location is required' });

    if (validations.length) {
        res.status(400).json({ status: 'error', validations: validations });
        return;
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Doctors");
        const countersCollection = db.collection("Counters");
        const workingHoursCollection = db.collection("WorkingHours");
        const workingDaysCollection = db.collection("Weekdays");

        const existingUser = await collection.findOne({ email });

        if (existingUser) {
            res.status(400).json({ status: 'error', message: 'Email already exists' });
        } else {
            const filePath = path.join('uploads/doctor', req.file.originalname);
            if (!fs.existsSync('uploads/doctor')) {
                fs.mkdirSync('uploads/doctor', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);
            const hashedPassword = await bcrypt.hash(password, 10);

            const counter = await countersCollection.findOneAndUpdate(
                { _id: "doctorId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            const newId = counter.seq;
            const counterAvailable = await countersCollection.findOneAndUpdate(
                { _id: "availableId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );

            // Parse workinghours and workingDays as arrays of integers
            const parsedWorkingHours = workinghours.split(',').map(Number);
            const parsedWorkingDays = workingDays.split(',').map(Number);
            const parsedAvailableSlots = availableSlots.split(',').map(Number);

            const workingHoursData = await workingHoursCollection.find({ _id: { $in: parsedWorkingHours } }).toArray();
            const workingDaysData = await workingDaysCollection.find({ _id: { $in: parsedWorkingDays } }).toArray();

            const workingHoursNames = workingHoursData.map(item => item.name);
            const workingDaysIndexes = workingDaysData.map(item => item.name);

            const result = await collection.insertOne({
                password: hashedPassword,
                name, hospital, about, type, patients, experience, rating, workinghours: workingHoursNames, availableSlots: parsedAvailableSlots, location, specialist, workingDays: workingDaysIndexes, videoFee, appointmentFee, email,
                _id: newId
            });

            if (result.acknowledged === true) {
                await createAvailabilitySchedule(newId, parsedWorkingDays, workingHoursNames, parsedAvailableSlots);
                return res.status(200).json({ status: 'success', message: 'Doctor registered successfully' });
            } else {
                res.status(400).json({ status: 'error', message: 'Registration failed' });
            }
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during registration', reason: error.message });
    } finally {
        await client.close();
    }
}






async function loginDoctor(req, res) {
    const { email, password } = req.body;
    let validations = [];

    if (!password) validations.push({ key: 'password', message: 'Password is required' });
    if (!email) validations.push({ key: 'email', message: 'Email is required' });


    if (validations.length) {
        res.status(400).json({ status: 'error', validations: validations });
        return;
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Doctors");
        const user = await collection.findOne({ email: email });

        if (user) {
            const result = await bcrypt.compare(password, user.password);
            if (result) {
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

                res.json({ status: 'success', message: 'Login successfull!', user: userInfo });
            } else {
                res.status(400).json({ status: 'error', message: 'Invalid Email or password' });
            }
        } else {
            res.status(400).json({ status: 'error', message: 'Invalid Email or password' });
        }
    } finally {
        await client.close();
    }
}

async function updateDoctor(req, res) {
    try {
    const {id, name, hospital, about, type, patients, experience, rating, workinghours, totalslots, availableSlots, location, specialist, workingDays, videoFee, appointmentFee, email, password } = req.body;
    let validations = [];
    let regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.*[A-Z])(?=.*[a-z])/;
    let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!id) validations.push({ key: 'id', message: 'id is required' });

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
        const collection = db.collection("Doctors");
        const user = await collection.findOne({_id: parseInt(id)});
        if (!user) {
            res.status(400).json({ status: 'error', message: 'Doctor not found' });
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
        if (req.file && req.file.buffer) {
            const filePath = path.join('uploads/doctor', req.file.originalname);
            if (!fs.existsSync('uploads/doctor')) {
                fs.mkdirSync('uploads/category', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);
            updatedFields.img = filePath;
        }

        const result = await collection.updateOne({ _id: parseInt(id) }, { $set: updatedFields });

        if (result.modifiedCount > 0) {
            res.status(200).json({ status: 'success', message: 'Doctor updated successfully' });
        } else {
            res.status(400).json({ status: 'error', message: 'Failed to update Doctor' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'An error occurred during update', reason: error });
    } finally {
        await client.close();
    }
} catch (error) {
    res.status(500).json({ message: 'Failed to update Doctor', error: error.message });
}
}

// Delete Doctor controller
async function deleteDoctor(req, res) {
    const { id } = req.body;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Doctor ID is required' });
        return;
    }

    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Doctors");

        const user = await collection.findOne({_id: parseInt(id) });

        if (!user) {
            res.status(400).json({ status: 'error', message: 'Doctor not found' });
            return;
        }

        const result = await collection.deleteOne({_id: parseInt(id) });

        if (result.deletedCount > 0) {
            res.status(200).json({ status: 'success', message: 'Doctor deleted successfully' });
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
        const collection = db.collection("Doctors");
        
        const doctors = await collection.find().toArray();
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch doctors', error: error.message });
    }
}

async function getAllAvailableDocter(req, res) {
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("doctoravailabilities");
        
        const doctors = await collection.find().toArray();
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch doctors', error: error.message });
    }
}
async function getDocterbyId(req, res) {
    const { id } = req.body;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Docter ID is required' });
        return;
    }
    try {
        const db = client.db("ImmunePlus");
        const collection = db.collection("doctoravailabilities");
        const doctors = await collection.findOne({doctorId: parseInt(id) });
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch doctors', error: error.message });
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
    upload
};
