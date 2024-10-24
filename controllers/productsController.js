const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');

const Product = require('../models/Product');

const client = new MongoClient(process.env.UU, {
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
        const {
            img, name, manufacturers, salt_composition, introduction, benefits, description,
            how_to_use, safety_advise, if_miss, Packaging, Package, Quantity, Product_Form, 
            MRP, prescription_required, common_side_effect, use_of, alcoholInteraction, 
            pregnancyInteraction, lactationInteraction, drivingInteraction, kidneyInteraction, 
            liverInteraction
        } = req.body;

        const db = client.db("ImmunePlus");
        const collection = db.collection("Products");
        const countersCollection = db.collection("Counters");

        let existing = await collection.findOne({ name });

        if (existing) {
            return res.status(400).json({ status: 'error', message: 'Product already exists' });
        } else {
            const counter = await countersCollection.findOneAndUpdate(
                { _id: "productId" },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
            const newId = counter.seq;

            const parsedPrescription = prescription_required === 'true';

            // Insert the new product into the database
            const result = await collection.insertOne({
                _id: newId,
                img: img || 'default_image_path_or_value',
                name,
                manufacturers,
                salt_composition,
                introduction,
                benefits,
                description,
                how_to_use,
                safety_advise,
                if_miss,
                Packaging,
                Package,
                Quantity: parseFloat(Quantity) || 0,
                Product_Form,
                MRP: parseFloat(MRP) || 0,
                prescription_required: parsedPrescription,
                common_side_effect,
                use_of,
                alcoholInteraction,
                pregnancyInteraction,
                lactationInteraction,
                drivingInteraction,
                kidneyInteraction,
                liverInteraction
            });

            if (result.acknowledged) {
                return res.status(200).json({ status: 'success', message: 'Product Saved' });
            } else {
                return res.status(400).json({ status: 'error', message: 'Creation failed' });
            }
        }
    } catch (error) {
        console.error('Failed to create product:', error.message);
        res.status(500).json({ message: 'Failed to create product', error: error.message });
    }
}

async function getAllProducts(req, res) {
    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Products");

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const searchQuery = req.query.searchQuery || '';

        const skip = (page - 1) * limit;

        const searchRegex = new RegExp(searchQuery, 'i');

        const products = await collection.find({
            name: searchRegex
        }).skip(skip).limit(limit).toArray();

        const totalProducts = await collection.countDocuments({
            name: searchRegex
        });

        res.json({
            totalProducts,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            products,
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch products', error: error.message });
    } finally {
        //await client.close();
    }
}


async function update(req, res) {
    try {
        await client.connect();

        const { id, name, description, price, pieces, dose, category } = req.body;
        const db = client.db("ImmunePlus");
        const collection = db.collection("Products");

        let existing = await collection.findOne({ name });

        if (existing) {
            return res.status(400).json({ status: 'error', message: 'Product already exists' });
        }

        let updateFields = { name, description, price };

        if (typeof pieces === 'string') {
            updateFields.pieces = pieces.split(',').map(item => parseFloat(item.trim()));
        } else if (Array.isArray(pieces)) {
            updateFields.pieces = pieces.map(item => parseFloat(item));
        }

        if (typeof dose === 'string') {
            updateFields.dose = dose.split(',').map(item => parseFloat(item.trim()));
        } else if (Array.isArray(dose)) {
            updateFields.dose = dose.map(item => parseFloat(item));
        }

        if (typeof category === 'string') {
            updateFields.category = category.split(',').map(item => parseFloat(item.trim()));
        } else if (Array.isArray(category)) {
            updateFields.category = category.map(item => parseFloat(item));
        }

        if (req.file && req.file.buffer) {
            const filePath = path.join('uploads/product', `${id}`);
            if (!fs.existsSync('uploads/product')) {
                fs.mkdirSync('uploads/product', { recursive: true });
            }
            fs.writeFileSync(filePath, req.file.buffer);
            updateFields.img = filePath;
        }

        const result = await collection.updateOne(
            { _id: parseInt(id) },
            { $set: updateFields }
        );

        if (result.modifiedCount === 1) {
            res.status(200).json({ status: 'success', message: 'Product Updated' });
        } else {
            res.status(400).json({ status: 'error', message: 'Update failed' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to update Product', error: error.message });
    } finally {
        //await client.close();
    }
}

// Controller function to delete a TypeOfTreatment
async function remove(req, res) {
    try {
        const { id } = req.body;
        await client.connect()
        const db = client.db("ImmunePlus");
        const collection = db.collection("Products");

        const user = await collection.findOne({ _id: parseInt(id) });
        console.log(user);
        const result = await collection.deleteOne({ _id: parseInt(id) });
        console.log(result);
        if (result.deletedCount > 0) {
            res.status(200).json({ status: 'success', message: 'Product Deleted' });
        } else {
            res.status(400).json({ status: 'error', message: 'Delete failed' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete Product', error: error });
    }
}

async function getProductById(req, res) {
    const { id } = req.query;

    if (!id) {
        res.status(400).json({ status: 'error', message: 'Product ID is required' });
        return;
    }
    try {
        await client.connect();
        const db = client.db("ImmunePlus");
        const collection = db.collection("Products");
        const product = await collection.find({_id: parseInt(id) }).toArray();
        if (product.length === 0) {
            res.status(404).json({ status: 'error', message: 'Product not found' });
        } else {
            res.json(product);
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch Product', error: error.message });
    }
}

async function searchProducts(req, res) {
    try {
      await client.connect();
      const db = client.db("ImmunePlus");
  
      const { keyword } = req.body;
  
      if (!keyword) {
        return res.status(400).json({
          status: "error",
          message: "Keyword is required for search",
        });
      }
  
      // Build the search query
      const searchQuery = {
        $or: [
          { name: { $regex: keyword, $options: "i" } },
          { category: { $regex: keyword, $options: "i" } },
          { sub_category: { $regex: keyword, $options: "i" } },
        ],
      };
  
      // Search in Products collection
      const productsCollection = db.collection("Products");
      const products = await productsCollection
        .find(searchQuery)
        .limit(10)
        .toArray();
  
      // Add a type field to indicate it's from Products
      const productsWithType = products.map((product) => ({
        ...product,
        type: 1, // Type 1 for Products
      }));
  
      // Search in OTC collection
      const otcCollection = db.collection("OTC");
      const otcProducts = await otcCollection
        .find(searchQuery)
        .limit(10)
        .toArray();
  
      // Add a type field to indicate it's from OTC
      const otcProductsWithType = otcProducts.map((product) => ({
        ...product,
        type: 2, // Type 2 for OTC
      }));
  
      // Combine both results
      const combinedResults = [...productsWithType, ...otcProductsWithType];
  
      if (combinedResults.length > 0) {
        res.status(200).json({
          status: "success",
          data: combinedResults,
        });
      } else {
        res.status(404).json({
          status: "error",
          message: "No products found matching the keyword",
        });
      }
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: "An error occurred during the search",
        reason: error.message,
      });
    } finally {
      //await client.close();
    }
  }
  
  async function searchFilterProducts(req, res) {
    try {
      await client.connect();
      const db = client.db("ImmunePlus");
      const productsCollection = db.collection("Products");
      const otcCollection = db.collection("Otc");
  
      // Extract the keyword, page, and limit from the request body
      const { keyword, page = 1, limit = 5 } = req.body;
  
      if (!keyword) {
        return res.status(400).json({
          status: "error",
          message: "Keyword is required for search",
        });
      }
  
      // Build the search query for MRP, name, and use_of fields
      const searchQuery = {
        $or: [
          { name: { $regex: keyword, $options: "i" } }, // Search in the 'name' field
          { MRP: { $regex: keyword, $options: "i" } }, // Search in the 'MRP' field
          { Category: { $regex: keyword, $options: "i" } },
          { SubCategory: { $regex: keyword, $options: "i" } },
          //{ use_of: { $regex: keyword, $options: "i" } }, // Search in the 'use_of' field
        ],
      };
  
      // Convert page and limit to integers
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
  
      // Search in both Products and Otc collections
      const products = await productsCollection.find(searchQuery).toArray();
      const otcs = await otcCollection.find(searchQuery).toArray();
  
      // Add type field (1 for Products, 2 for Otc)
      const productsWithType = products.map((product) => ({
        ...product,
        type: 1, // Products type
      }));
  
      const otcsWithType = otcs.map((otc) => ({
        ...otc,
        type: 2, // Otc type
      }));
  
      // Combine both Products and Otc results
      const combinedResults = [...productsWithType, ...otcsWithType];
  
      // Total count before pagination
      const totalCount = combinedResults.length;
  
      // Apply pagination to combined results
      const paginatedResults = combinedResults.slice(
        (pageNum - 1) * limitNum,
        pageNum * limitNum
      );
  
      if (paginatedResults.length > 0) {
        res.status(200).json({
          status: "success",
          data: paginatedResults,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalItems: totalCount,
          },
        });
      } else {
        res.status(404).json({
          status: "error",
          message: "No Products or Otc items found matching the criteria",
        });
      }
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: "An error occurred during the search",
        reason: error.message,
      });
    } finally {
      // await client.close();
    }
  }

module.exports = {
    create,
    getAllProducts,
    upload,
    update,
    remove,
    getProductById,
    searchProducts,
    searchFilterProducts,
};

// async function create(req, res) {
//     try {
//         await client.connect();
//         const { name, description, price, pieces, dose, category, prescription } = req.body;
//         const db = client.db("ImmunePlus");
//         const collection = db.collection("Products");
//         const countersCollection = db.collection("Counters");

//         let validations = [];

//         if (!description) validations.push({ key: 'description', message: 'Description is required' });
//         if (!name) validations.push({ key: 'name', message: 'Name is required' });
//         if (!price) validations.push({ key: 'price', message: 'Price is required' });
//         if (!pieces) validations.push({ key: 'pieces', message: 'Pieces is required' });
//         if (!dose) validations.push({ key: 'dose', message: 'Dose is required' });
//         if (!category) validations.push({ key: 'category', message: 'At least 1 Category is required' });
//         if (!prescription) validations.push({ key: 'prescription', message: 'Please tell prescription true or false' });
//         if (!req.file || !req.file.buffer) validations.push({ key: 'img', message: 'Image is required' });

//         if (validations.length) {
//             return res.status(400).json({ status: 'error', validations: validations });
//         }

//         let existing = await collection.findOne({ name });

//         if (existing) {
//             return res.status(400).json({ status: 'error', message: 'Product already exists' });
//         } else {
//             const counter = await countersCollection.findOneAndUpdate(
//                 { _id: "productId" },
//                 { $inc: { seq: 1 } },
//                 { upsert: true, returnDocument: 'after' }
//             );
//             const newId = counter.seq;
//             const filePath = path.join('uploads/product', `${newId}`);
//             if (!fs.existsSync('uploads/product')) {
//                 fs.mkdirSync('uploads/product', { recursive: true });
//             }
//             fs.writeFileSync(filePath, req.file.buffer);

//             // Ensure pieces and dose are strings before attempting to split them
//             let piecesArray, doseArray, categoryArray;

//             if (typeof pieces === 'string') {
//                 piecesArray = pieces.split(',').map(item => parseFloat(item.trim()));
//             } else if (Array.isArray(pieces)) {
//                 piecesArray = pieces.map(item => parseFloat(item));
//             } else {
//                 piecesArray = [];
//             }

//             if (typeof dose === 'string') {
//                 doseArray = dose.split(',').map(item => parseFloat(item.trim()));
//             } else if (Array.isArray(dose)) {
//                 doseArray = dose.map(item => parseFloat(item));
//             } else {
//                 doseArray = [];
//             }

//             if (typeof category === 'string') {
//                 categoryArray = category.split(',').map(item => parseFloat(item.trim()));
//             } else if (Array.isArray(category)) {
//                 categoryArray = category.map(item => parseFloat(item));
//             } else {
//                 categoryArray = [];
//             }

//             if (!Array.isArray(piecesArray) || piecesArray.length === 0) {
//                 return res.status(400).json({ status: 'error', message: 'Pieces should be a non-empty array' });
//             }

//             if (!Array.isArray(doseArray) || doseArray.length === 0) {
//                 return res.status(400).json({ status: 'error', message: 'Dose should be a non-empty array' });
//             }

            
//             if (!Array.isArray(categoryArray) || categoryArray.length === 0) {
//                 return res.status(400).json({ status: 'error', message: 'Dose should be a non-empty array' });
//             }

//             // Get and increment the counter for TypeOfTreatment


//             const result = await collection.insertOne({
//                 _id: newId,
//                 name,
//                 description,
//                 img: filePath,
//                 price,
//                 pieces: piecesArray,
//                 dose: doseArray,
//                 category: categoryArray,
//                 prescription: JSON.parse(prescription)
//             });

//             if (result.acknowledged === true) {
//                 return res.status(200).json({ status: 'success', message: 'Product Saved' });
//             } else {
//                 return res.status(400).json({ status: 'error', message: 'Creation failed' });
//             }
//         }
//     } catch (error) {
//         res.status(500).json({ message: 'Failed to create product', error: error.message });
//     } finally {
//         //await client.close();
//     }
// }