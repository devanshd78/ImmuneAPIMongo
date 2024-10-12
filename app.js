const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const http = require("http");
const socketIo = require("socket.io");
const cron = require("node-cron");
require("dotenv").config();

const userRoutes = require("./routes/userRoutes");
const ageGroupRoutes = require("./routes/ageGroup");
const typeOfTreatment = require("./routes/typeOfTreatment");
const categoryRoutes = require("./routes/categoryRoutes");
const subCategoryRoutes = require("./routes/subCategoryRoutes");
const weekdayRoutes = require("./routes/weekdays");
const docterRoutes = require("./routes/docterRoutes");
const workingHours = require("./routes/workingHours");
const productRoutes = require("./routes/productRoutes");
const otcRoutes = require("./routes/otcRoutes");
const pharmaRoutes = require("./routes/pharmaRoutes");
const orderRoutes = require("./routes/orderRoutes");
const userReviewPosterRoutes = require("./routes/userReviewPosterRoutes");
const docterSpecRoutes = require("./routes/docterSpecRoutes");
const deliveryRoutes = require("./routes/deliveryPartner");
const paymentBookingRoutes = require("./routes/paymentBookingRoutes");
const paymentOrderRoutes = require("./routes/paymentOrderRoutes");
const paymentDeliveryRoutes = require("./routes/paymentDeliveryRoutes");
const userNotification = require("./routes/notificationRoutes/userNotificationRoutes");
const pharmaNotification = require("./routes/notificationRoutes/pharmaNotificationRoutes");
const docterNotification = require("./routes/notificationRoutes/docterNotificationRoutes");
const posterRoutes = require("./routes/posterRoutes");
const adminRoutes = require("./routes/admin");
const fullBodyCheckupRoutes = require("./routes/fullBodyCheckup");
const couponsRoutes = require("./routes/couponsRoutes");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"],
  },
});
const port = 6000;

// Configure CORS to allow requests from specific origins
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

app.use("/users", userRoutes);
app.use("/ageGroups", ageGroupRoutes);
app.use("/typeOfTreatment", typeOfTreatment);
app.use(express.json());
app.use("/uploads", express.static("uploads")); // Serve uploaded files statically
app.use("/category", categoryRoutes);
app.use("/subCategory", subCategoryRoutes);
app.use("/weekday", weekdayRoutes);
app.use("/docter", docterRoutes);
app.use("/workingHours", workingHours);
app.use("/product", productRoutes);
app.use("/otc", otcRoutes);
app.use("/pharma", pharmaRoutes);
app.use("/order", orderRoutes);
app.use("/userReviewPoster", userReviewPosterRoutes);
app.use("/docterSpec", docterSpecRoutes);
app.use("/delivery", deliveryRoutes);
app.use("/paymentBooking", paymentBookingRoutes);
app.use("/paymentOrder", paymentOrderRoutes);
app.use("/paymentDelivery", paymentDeliveryRoutes);
app.use("/userNotification", userNotification);
app.use("/pharmaNotification", pharmaNotification);
app.use("/docterNotification", docterNotification);
app.use("/poster", posterRoutes);
app.use("/admin", adminRoutes);
app.use("/fullBody", fullBodyCheckupRoutes);
app.use("/coupon", couponsRoutes);

io.on("connection", (socket) => {
  console.log("New client connected");
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

global.io = io;

mongoose
  .connect(process.env.UU, {})
  .then(() => {
    console.log("Connected to MongoDB (Compass)");
    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });
