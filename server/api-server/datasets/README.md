# Kaggle Dataset Integration

This directory contains scripts and utilities for downloading and using Kaggle datasets to improve the vendor/client onboarding system.

## Setup

### 1. Install Kaggle API

```bash
pip install kaggle
```

### 2. Get Your Kaggle API Credentials

1. Go to https://www.kaggle.com/account
2. Scroll down to "API" section
3. Click "Create New API Token"
4. This downloads `kaggle.json` file

### 3. Place Kaggle Credentials

**Option A: Place in home directory (recommended)**
```bash
mkdir -p ~/.kaggle
cp kaggle.json ~/.kaggle/
chmod 600 ~/.kaggle/kaggle.json
```

**Option B: Place in project directory**
```bash
cp kaggle.json server/api-server/datasets/
```

## Recommended Datasets

### Vendor/Supplier Management Datasets:
- `vendor-management-dataset` - Vendor information and risk scores
- `supplier-data` - Supplier onboarding data
- `company-registration-data` - Business registration information

### Fraud Detection Datasets:
- `fraud-detection-dataset` - Fraud patterns and indicators
- `financial-fraud-data` - Financial transaction fraud data

## Usage

### Download Dataset
```bash
cd server/api-server/datasets
node download-dataset.js <dataset-name>
```

### Process and Load Dataset
```bash
node process-dataset.js <dataset-file.csv>
```

### Use for Training/Validation
The processed data will be available in the application for:
- Training risk scoring models
- Validating extraction accuracy
- Benchmarking performance
- Populating test data

