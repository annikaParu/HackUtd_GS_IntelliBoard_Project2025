// download-dataset.js
// Script to download datasets from Kaggle using the Kaggle API

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Common vendor/client management datasets
const RECOMMENDED_DATASETS = {
  'vendor-management': 'vendor-management-dataset',
  'supplier-data': 'supplier-data',
  'company-registry': 'company-registration-data',
  'fraud-detection': 'fraud-detection-dataset'
};

async function downloadDataset(datasetName) {
  const datasetsDir = path.join(__dirname, 'raw');
  
  // Create directories if they don't exist
  if (!fs.existsSync(datasetsDir)) {
    fs.mkdirSync(datasetsDir, { recursive: true });
  }

  // Check if kaggle is installed
  try {
    await execAsync('which kaggle');
  } catch (error) {
    console.error('❌ Kaggle CLI not found. Please install it first:');
    console.error('   pip install kaggle');
    console.error('   Then set up your API credentials: ~/.kaggle/kaggle.json');
    process.exit(1);
  }

  // Resolve dataset name if it's a shortcut
  const actualName = RECOMMENDED_DATASETS[datasetName] || datasetName;

  console.log(`📥 Downloading dataset: ${actualName}`);
  console.log(`📁 Saving to: ${datasetsDir}`);

  try {
    // Download dataset
    const { stdout, stderr } = await execAsync(
      `kaggle datasets download -d ${actualName} -p "${datasetsDir}" --unzip`
    );
    
    if (stderr && !stderr.includes('Downloading')) {
      console.warn('⚠️  Warning:', stderr);
    }
    
    console.log('✅ Dataset downloaded successfully!');
    console.log(`📂 Files saved in: ${datasetsDir}`);
    
    // List downloaded files
    const files = fs.readdirSync(datasetsDir);
    console.log('\n📄 Downloaded files:');
    files.forEach(file => {
      const filePath = path.join(datasetsDir, file);
      const stats = fs.statSync(filePath);
      console.log(`   - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    });
    
  } catch (error) {
    console.error('❌ Error downloading dataset:', error.message);
    console.error('\n💡 Tips:');
    console.error('   1. Make sure the dataset name is correct');
    console.error('   2. Check that your Kaggle API credentials are set up');
    console.error('   3. Verify you have access to the dataset');
    process.exit(1);
  }
}

// Main execution
const datasetName = process.argv[2];

if (!datasetName) {
  console.log('📊 Kaggle Dataset Downloader\n');
  console.log('Usage: node download-dataset.js <dataset-name>\n');
  console.log('Available shortcuts:');
  Object.entries(RECOMMENDED_DATASETS).forEach(([shortcut, fullName]) => {
    console.log(`   ${shortcut} -> ${fullName}`);
  });
  console.log('\nOr use full dataset name from Kaggle URL');
  process.exit(0);
}

downloadDataset(datasetName).catch(console.error);

