// dataset-loader.js
// Module to load and use processed Kaggle datasets in the application

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scoreRisk } from '../risk.js';
import { analyzeDocumentPrivacy } from '../privacy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROCESSED_DIR = path.join(__dirname, 'processed');

/**
 * Load all processed datasets
 */
export function loadProcessedDatasets() {
  if (!fs.existsSync(PROCESSED_DIR)) {
    return [];
  }

  const files = fs.readdirSync(PROCESSED_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(PROCESSED_DIR, file));

  const allVendors = [];
  
  files.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const vendors = JSON.parse(content);
      allVendors.push(...vendors);
    } catch (error) {
      console.warn(`⚠️  Error loading ${file}:`, error.message);
    }
  });

  return allVendors;
}

/**
 * Get vendors for training/validation
 */
export function getTrainingData(options = {}) {
  const {
    limit = null,
    withRiskScores = false,
    shuffle = false
  } = options;

  let vendors = loadProcessedDatasets();

  // Filter vendors with risk scores if requested
  if (withRiskScores) {
    vendors = vendors.filter(v => v.riskScore !== null && v.riskScore !== undefined);
  }

  // Shuffle if requested
  if (shuffle) {
    vendors = vendors.sort(() => Math.random() - 0.5);
  }

  // Limit if specified
  if (limit) {
    vendors = vendors.slice(0, limit);
  }

  return vendors;
}

/**
 * Enrich vendor with risk score and privacy analysis
 */
export function enrichVendorData(vendor) {
  // Calculate risk score if not present
  if (!vendor.riskScore) {
    const riskResult = scoreRisk({
      businessName: vendor.businessName || '',
      registrationNo: vendor.registrationNo || '',
      address: vendor.address || '',
      entityType: vendor.entityType || ''
    });
    vendor.riskScore = riskResult.score;
    vendor.riskBand = riskResult.band;
    vendor.riskReasons = riskResult.reasons;
  }

  // Analyze privacy if address or other fields contain potential PII
  const textToAnalyze = [
    vendor.businessName,
    vendor.address,
    vendor.email,
    vendor.registrationNo
  ].filter(Boolean).join(' ');

  if (textToAnalyze) {
    vendor.privacyAnalysis = analyzeDocumentPrivacy(textToAnalyze);
  }

  return vendor;
}

/**
 * Get benchmark dataset for testing
 */
export function getBenchmarkDataset(size = 100) {
  const vendors = loadProcessedDatasets();
  
  // Take a sample and enrich with risk scores
  const sample = vendors.slice(0, size).map(v => enrichVendorData(v));
  
  return sample;
}

/**
 * Validate extraction accuracy against dataset
 */
export function validateExtraction(extractedFields, datasetVendor) {
  const accuracy = {
    businessName: 0,
    registrationNo: 0,
    address: 0,
    entityType: 0,
    overall: 0
  };

  // Simple string matching (in production, use fuzzy matching)
  if (extractedFields.businessName && datasetVendor.businessName) {
    accuracy.businessName = extractedFields.businessName.toLowerCase() === datasetVendor.businessName.toLowerCase() ? 1 : 0;
  }

  if (extractedFields.registrationNo && datasetVendor.registrationNo) {
    accuracy.registrationNo = extractedFields.registrationNo === datasetVendor.registrationNo ? 1 : 0;
  }

  if (extractedFields.address && datasetVendor.address) {
    accuracy.address = extractedFields.address.toLowerCase().includes(datasetVendor.address.toLowerCase()) ? 1 : 0;
  }

  if (extractedFields.entityType && datasetVendor.entityType) {
    accuracy.entityType = extractedFields.entityType.toLowerCase() === datasetVendor.entityType.toLowerCase() ? 1 : 0;
  }

  // Calculate overall accuracy
  const fields = ['businessName', 'registrationNo', 'address', 'entityType'];
  const total = fields.reduce((sum, field) => sum + (datasetVendor[field] ? 1 : 0), 0);
  const correct = fields.reduce((sum, field) => sum + accuracy[field], 0);
  accuracy.overall = total > 0 ? correct / total : 0;

  return accuracy;
}

/**
 * Seed database with dataset vendors
 */
export function seedDatabaseWithDataset(db, limit = 50) {
  const vendors = getTrainingData({ limit, shuffle: true });
  
  vendors.forEach(vendor => {
    const enriched = enrichVendorData(vendor);
    
    // Add to database if not already present
    const exists = db.vendors.find(v => 
      v.name === enriched.businessName || 
      v.email === enriched.email
    );
    
    if (!exists) {
      db.vendors.push({
        id: `dataset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: enriched.businessName,
        email: enriched.email,
        country: enriched.country,
        address: enriched.address,
        taxId: enriched.registrationNo,
        risk: enriched.riskScore,
        status: enriched.riskScore >= 80 ? 'Approved' : enriched.riskScore >= 50 ? 'Review' : 'High Risk'
      });
    }
  });
  
  console.log(`✅ Seeded database with ${vendors.length} vendors from dataset`);
  return vendors.length;
}

