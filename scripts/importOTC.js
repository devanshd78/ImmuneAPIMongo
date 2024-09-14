const axios = require('axios');
const XLSX = require('xlsx');
const path = require('path');

// Path to your Excel file
const excelFilePath = path.join(__dirname, '../uploads/DataOTC.xlsx');

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
        const apiUrl = 'http://localhost:5000/otc/create';

        for (const row of data) {
            const img = row.Id || '';
            const name = row.name || '';
            const manufacturers = row.manufacturers || '';
            const category = row.category || '';
            const sub_category = row.sub_category || '';
            const Packaging = row.Packaging || '';
            const Package = row.Package || '';
            const Quantity = parseFloat(row.Quantity) || 0;
            const Product_Form = row.Product_Form || '';
            const MRP = parseFloat(row.MRP) || 0;
            const prescription_required = row.prescription_required === 'Prescription Required';
            const primary_use = row.primary_use || '';
            const description = row.description || '';
            const salt_synonmys = row.salt_synonmys || '';
            const storage = row.storage || '';
            const introduction = row.introduction || '';
            const use_of = row.use_of || '';
            const benefits = row.benefits || '';
            const side_effect = row.side_effect || '';
            const how_to_use = row.how_to_use || '';
            const how_works = row.how_works || '';
            const safety_advise = row.safety_advise || '';
            const if_miss = row.if_miss || '';
            const ingredients = row.ingredients || '';
            const country_of_origin = row.country_of_origin || '';

            // Prepare JSON object
            const dataToSend = {
                img,
                name,
                manufacturers,
                category,
                sub_category,
                Packaging,
                Package,
                Quantity,
                Product_Form,
                MRP,
                prescription_required,
                primary_use,
                description,
                salt_synonmys,
                storage,
                introduction,
                use_of,
                benefits,
                side_effect,
                how_to_use,
                how_works,
                safety_advise,
                if_miss,
                ingredients,
                country_of_origin
            };

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