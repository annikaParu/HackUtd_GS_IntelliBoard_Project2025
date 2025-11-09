// process-dataset.js
// Script to process and normalize Kaggle datasets for use in the application

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Process CSV file and convert to normalized vendor/client format
 */
function processCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  const vendors = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) continue;
    
    const vendor = {};
    headers.forEach((header, idx) => {
      const value = values[idx];
      if (value && value !== '') {
        // Map common column names to our format
        if (header.includes('name') || header.includes('company')) {
          vendor.businessName = value;
        } else if (header.includes('registration') || header.includes('tax') || header.includes('ein')) {
          vendor.registrationNo = value;
        } else if (header.includes('address')) {
          vendor.address = value;
        } else if (header.includes('type') || header.includes('entity')) {
          vendor.entityType = value;
        } else if (header.includes('email')) {
          vendor.email = value;
        } else if (header.includes('country')) {
          vendor.country = value;
        } else if (header.includes('risk') || header.includes('score')) {
          vendor.riskScore = parseFloat(value) || null;
        } else {
          vendor[header] = value;
        }
      }
    });
    
    // Only add if we have at least a business name
    if (vendor.businessName) {
      vendors.push(vendor);
    }
  }
  
  return vendors;
}

/**
 * Process JSON file
 */
function processJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  // Handle array of objects
  if (Array.isArray(data)) {
    return data.map(item => normalizeVendor(item));
  }
  
  // Handle object with array property
  if (data.vendors || data.suppliers || data.companies) {
    const array = data.vendors || data.suppliers || data.companies;
    return array.map(item => normalizeVendor(item));
  }
  
  return [];
}

/**
 * Normalize vendor object to our format
 */
function normalizeVendor(item) {
  return {
    businessName: item.businessName || item.name || item.company || item.companyName || '',
    registrationNo: item.registrationNo || item.registrationNumber || item.taxId || item.ein || '',
    address: item.address || item.fullAddress || item.location || '',
    entityType: item.entityType || item.type || item.entity || '',
    email: item.email || item.contactEmail || '',
    country: item.country || item.countryCode || '',
    riskScore: item.riskScore || item.risk || item.riskRating || null
  };
}

/**
 * Main processing function
 */
function processDataset(filePath) {
  const fullPath = path.isAbsolute(filePath) 
    ? filePath 
    : path.join(__dirname, 'raw', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${fullPath}`);
    process.exit(1);
  }
  
  const ext = path.extname(fullPath).toLowerCase();
  let vendors = [];
  
  console.log(`📄 Processing file: ${path.basename(fullPath)}`);
  
  try {
    if (ext === '.csv') {
      vendors = processCSV(fullPath);
    } else if (ext === '.json') {
      vendors = processJSON(fullPath);
    } else {
      console.error(`❌ Unsupported file type: ${ext}`);
      console.error('   Supported formats: .csv, .json');
      process.exit(1);
    }
    
    console.log(`✅ Processed ${vendors.length} vendors/clients`);
    
    // Save processed data
    const outputDir = path.join(__dirname, 'processed');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, `processed-${Date.now()}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(vendors, null, 2));
    
    console.log(`💾 Saved processed data to: ${outputPath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   Total records: ${vendors.length}`);
    console.log(`   With business name: ${vendors.filter(v => v.businessName).length}`);
    console.log(`   With registration: ${vendors.filter(v => v.registrationNo).length}`);
    console.log(`   With address: ${vendors.filter(v => v.address).length}`);
    console.log(`   With risk scores: ${vendors.filter(v => v.riskScore).length}`);
    
    return vendors;
  } catch (error) {
    console.error('❌ Error processing dataset:', error.message);
    process.exit(1);
  }
}

// Main execution
const filePath = process.argv[2];

if (!filePath) {
  console.log('📊 Dataset Processor\n');
  console.log('Usage: node process-dataset.js <dataset-file.csv|json>\n');
  console.log('Example:');
  console.log('   node process-dataset.js raw/vendor-data.csv');
  process.exit(0);
}

processDataset(filePath);

