const axios = require('axios');
const XLSX = require('xlsx');
const path = require('path');

// Path to your Excel file
const excelFilePath = path.join(__dirname, '../uploads/Data.xlsx');

async function processAndUploadFile() {
    try {
        // Read the Excel file
        const workbook = XLSX.readFile(excelFilePath);
        const sheetNames = workbook.SheetNames;
        const sheet = workbook.Sheets[sheetNames[0]];

        // Convert the sheet to JSON
        const data = XLSX.utils.sheet_to_json(sheet);

        if (data.length === 0) {
            throw new Error('No data found in the Excel file');
        }

        // API URL
        const apiUrl = 'http://localhost:5000/product/create';

        // Process and upload each row
        for (const row of data) {
            const name = row.name || '';
            const manufacturers = row.manufacturers || '';
            const salt_composition = row.salt_composition || '';
            const introduction = row.introduction || '';
            const benefits = row.benefits || '';
            const description = row.description || '';
            const how_to_use = row.how_to_use || '';
            const safety_advise = row.safety_advise || '';
            const if_miss = row.if_miss || '';
            const Packaging = row.Packaging || '';
            const Package = row.Package || '';
            const Quantity = row.Quantity || 0;
            const Product_Form = row.Product_Form || '';
            const MRP = row.MRP || 0;
            const prescription_required = row.prescription_required === 'Prescription Required';
            const common_side_effect = row.common_side_effect || '';
            const use_of = row.use_of || '';
            const alcoholInteraction = row.alcoholInteraction || '';
            const pregnancyInteraction = row.pregnancyInteraction || '';
            const lactationInteraction = row.lactationInteraction || '';
            const drivingInteraction = row.drivingInteraction || '';
            const kidneyInteraction = row.kidneyInteraction || '';
            const liverInteraction = row.liverInteraction || '';
            const img = row.Id || '';

            // Prepare JSON object
            const dataToSend = {
                img,
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
                Quantity,
                Product_Form,
                MRP,
                prescription_required,
                common_side_effect,
                use_of,
                alcoholInteraction,
                pregnancyInteraction,
                lactationInteraction,
                drivingInteraction,
                kidneyInteraction,
                liverInteraction
            };


            // Make the POST request
            try {
                const response = await axios.post(apiUrl, dataToSend, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                console.log('Upload successful:', response.data);
            } catch (uploadError) {
                console.error('Error uploading data:', uploadError.message);
            }
        }

    } catch (error) {
        console.error('Error processing and uploading file:', error.message);
    }
}

processAndUploadFile();
