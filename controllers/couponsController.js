const { MongoClient, ServerApiVersion } = require("mongodb");

const client = new MongoClient(process.env.UU, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Controller function to create a new age group
//sorry some change, make a calculate amount function where i will send you productsprice in array and coupon and you will give me result in totalPrice, DeliveryFee(Rs 20), gst (18%) of the totalPrice and i will send you userId also where you can check the max and expiryDate, min
async function create(req, res) {
  // Type: 1 - delivery free, 2 - percentage discount
  // discountType: 1 - %, 2 - amount
  //  "expiryDate": "unlimited" for not expiring,

  //   {
  //     "name": "SUMMER2024",
  //     "description": "Summer special discount",
  //     "type": 2,
  //     "max": 100,
  //     "expiryDate": "2024-12-31",
  //     "minPrice": 500,
  //     "discountType": 1,
  //     "percent": 10
  //   }

  try {
    await client.connect();
    const {
      id,
      name,
      description,
      type,
      max,
      expiryDate,
      minPrice,
      percent,
      amount,
      discountType,
    } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("Coupon");
    const countersCollection = db.collection("Counters");

    let validations = [];

    // Input validation
    if (!name) validations.push({ key: "name", message: "Name is required" });
    if (!minPrice)
      validations.push({ key: "minPrice", message: "Min Price is required" });
    if (!type) validations.push({ key: "type", message: "Type is required" });
    if (!expiryDate)
      validations.push({
        key: "expiryDate",
        message: "Expiry Date is required",
      });
    if (!max)
      validations.push({
        key: "max",
        message: "Max number of usage is required",
      });
    if (discountType === 1 && !percent) {
      validations.push({
        key: "percent",
        message: "Percentage is required for percentage discount",
      });
    }
    if (discountType === 2 && !amount) {
      validations.push({
        key: "amount",
        message: "Price is required for amount discount",
      });
    }

    if (validations.length) {
      return res.status(400).json({ status: "error", validations });
    }

    // Check if we are updating or creating a new coupon
    if (id) {
      // Update existing coupon
      const existingCoupon = await collection.findOne({ _id: parseInt(id) });

      if (!existingCoupon) {
        return res
          .status(404)
          .json({ status: "error", message: "Coupon not found" });
      }

      // Update coupon details, including expiryDate, discountType, etc.
      const updateResult = await collection.updateOne(
        { _id: parseInt(id) },
        {
          $set: {
            name,
            description,
            max,
            type,
            minPrice,
            expiryDate,
            discountType,
            percent,
            amount,
          },
        }
      );

      if (updateResult.modifiedCount > 0) {
        return res.status(200).json({
          status: "success",
          message: "Coupon updated successfully",
        });
      } else {
        return res.status(400).json({
          status: "error",
          message: "Coupon update failed",
        });
      }
    } else {
      // Check if the coupon already exists by name and type when creating a new coupon
      let existing = await collection.findOne({ name, type });

      if (existing) {
        return res
          .status(400)
          .json({ status: "error", message: "Coupon already exists" });
      }

      // Get and increment the counter for Coupon ID
      const counter = await countersCollection.findOneAndUpdate(
        { _id: "couponId" },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after" }
      );
      const newId = counter.seq;

      // Insert new coupon with expiryDate, minPrice, and other fields
      const result = await collection.insertOne({
        _id: newId,
        name,
        description,
        max,
        type,
        minPrice,
        expiryDate,
        discountType,
        percent,
        amount,
      });

      if (result.acknowledged) {
        return res
          .status(200)
          .json({ status: "success", message: "Coupon Saved" });
      } else {
        return res
          .status(400)
          .json({ status: "error", message: "Creation failed" });
      }
    }
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create or update Coupon",
      error: error.message,
    });
  }
}

async function calculatePrice(req, res) {
  // {
  //     "userId": "41120",
  //     "productsPrice": [100, 200, 300],
  //     "couponId": 3
  //   }

  try {
    await client.connect();
    const { userId, productsPrice, couponId } = req.body;
    const db = client.db("ImmunePlus");
    const couponCollection = db.collection("Coupon");
    const orderCollection = db.collection("Orders");

    // Validate input
    if (!userId || !productsPrice || productsPrice.length === 0 || !couponId) {
      return res.status(400).json({
        status: "error",
        message: "User ID, productsPrice array, and couponId are required",
      });
    }

    // Calculate total price of products
    const totalProductPrice = productsPrice.reduce(
      (total, price) => total + price,
      0
    );

    // Fetch coupon details
    const coupon = await couponCollection.findOne({ _id: parseInt(couponId) });

    if (!coupon) {
      return res
        .status(404)
        .json({ status: "error", message: "Coupon not found" });
    }

    // Check coupon validity
    if (coupon.expiryDate != "unlimited") {
      const currentDate = new Date();
      if (new Date(coupon.expiryDate) < currentDate) {
        return res
          .status(400)
          .json({ status: "error", message: "Coupon expired" });
      }
    }

    const userOrdersWithCoupon = await orderCollection.countDocuments({
      userId: userId,
      coupon: parseInt(couponId),
    });

    if (userOrdersWithCoupon >= coupon.max) {
      return res.status(400).json({
        status: "error",
        message: "Coupon usage limit reached",
      });
    }

    if (totalProductPrice < coupon.minPrice) {
      return res.status(400).json({
        status: "error",
        message: `Minimum price required to use coupon is ${coupon.minPrice}`,
      });
    }

    // Delivery fee is fixed at Rs 20
    let deliveryFee = 20;
    let discount = 0;

    // Apply coupon
    if (coupon.type === 1) {
      // Type 1: Delivery free
      deliveryFee = 0;
    } else if (coupon.type === 2) {
      // Type 2: Discount
      if (coupon.discountType === 1) {
        // Percentage discount
        discount = (totalProductPrice * coupon.percent) / 100;
      } else if (coupon.discountType === 2) {
        // Fixed amount discount
        discount = coupon.amount;
      }
    }

    // Final price calculation
    const discountedPrice = totalProductPrice - discount;
    const gst = discountedPrice * 0.18; // 18% GST
    const finalPrice = discountedPrice + gst + deliveryFee;
    res.status(200).json({
      status: "success",
      totalProductPrice,
      discount,
      deliveryFee,
      gst,
      finalPrice,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to calculate price",
      error: error.message,
    });
  }
}

// Controller function to get all age groups
async function getAll(req, res) {
  try {
    const db = client.db("ImmunePlus");
    const collection = db.collection("Coupon");

    const coupon = await collection.find().toArray();
    res.json(coupon);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch Coupon", error: error.message });
  }
}

async function getCouponsByUser(req, res) {
  // {
  //     "userId": "41120",
  //     "productsPrice": [100, 200, 300]
  //   }

  try {
    await client.connect();
    const { userId, productsPrice } = req.body; // Expecting userId and productsPrice

    // Validate input
    if (!userId || !productsPrice || productsPrice.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "User ID and productsPrice array are required",
      });
    }

    const db = client.db("ImmunePlus");
    const couponCollection = db.collection("Coupon");
    const orderCollection = db.collection("Orders");

    // Calculate total price of products
    const totalProductPrice = productsPrice.reduce(
      (total, price) => total + price,
      0
    );

    // Fetch all coupons
    const allCoupons = await couponCollection.find().toArray();
    const validCoupons = [];

    const currentDate = new Date();

    for (const coupon of allCoupons) {
      // Check coupon expiry
      if (
        coupon.expiryDate !== "unlimited" &&
        new Date(coupon.expiryDate) < currentDate
      ) {
        continue; // Skip expired coupons
      }

      // Check if the user has already used the coupon
      const userOrdersWithCoupon = await orderCollection.countDocuments({
        userId: userId,
        coupon: parseInt(coupon._id),
      });

      if (userOrdersWithCoupon >= coupon.max) {
        continue; // Skip if usage limit is reached
      }

      // Check minimum price requirement
      if (totalProductPrice < coupon.minPrice) {
        continue; // Skip if minimum price is not met
      }

      // If the coupon passes all checks, add it to validCoupons
      validCoupons.push(coupon);
    }

    res.status(200).json({
      status: "success",
      validCoupons,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve coupons",
      error: error.message,
    });
  }
}

async function getCouponsById(req, res) {
  try {
    const db = client.db("ImmunePlus");
    const collection = db.collection("Coupon");

    const coupon = await collection.find().toArray();
    res.json(coupon);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch Coupon", error: error.message });
  }
}

// Controller function to delete a TypeOfTreatment
async function remove(req, res) {
  try {
    const { id } = req.body;
    const db = client.db("ImmunePlus");
    const collection = db.collection("Coupon");

    const result = await collection.deleteOne({ _id: parseInt(id) });
    if (result.deletedCount > 0) {
      res.status(200).json({ status: "success", message: "Coupon Deleted" });
    } else {
      res.status(400).json({ status: "error", message: "Delete failed" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete Coupon", error: error });
  }
}

module.exports = {
  create,
  getAll,
  remove,
  calculatePrice,
  getCouponsByUser,
};
