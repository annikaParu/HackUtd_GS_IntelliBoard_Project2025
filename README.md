# IntelliBoard - Vendor Onboarding & Risk Platform

IntelliBoard is a vendor/client onboarding and risk platform that turns messy, manual intake into a 1–2 minute guided flow: upload a document → AI extracts fields → risk is scored → approvals and access are provisioned with audit-ready evidence.

## Features

- ✅ **AI-Assisted Intake**: Upload registration PDFs/images; OCR+parse auto-fills vendor/client fields
- ✅ **AI-Powered Risk Assessment**: OpenAI analyzes vendor/client information to determine trust/risk scores with intelligent reasoning
- ✅ **Privacy & PII Detection**: Automatically detects and masks PII (emails, phones, SSNs, credit cards, etc.) with risk-based recommendations
- ✅ **Fraud Detection**: Real-time watchlist screening and behavioral pattern analysis
- ✅ **Automated Workflow Engine**: 7-phase lifecycle management with dynamic routing and approvals
- ✅ **Security Assessment**: Compliance checks for registration, address validation, sanctions screening
- ✅ **Offline Support**: Works with local watchlist + OCR; escalates to OpenAI for normalization when available
- ✅ **Risk Scoring**: AI-powered analysis (when available) or deterministic rules compute a 0–100 score with clear explainability
- ✅ **Compliance & Audit Trail**: Every event (upload, edit, decision) is logged with timestamps & user IDs
- ✅ **Professional UX**: Goldman-Sachs-style app chrome with sidebar, topbar, right-rail risk panel
- ✅ **Client & Vendor Support**: Unified platform for both vendor and client onboarding

## Architecture

```
Frontend (Vite + React + TypeScript)
   └── calls REST API (fetch, VITE_API_URL)
Backend (Node/Express)
   ├── /extract         -> parse + structure fields from PDF/img (includes PII detection)
   ├── /risk/score      -> compute score + reasons + checks
   ├── /vendors/:id     -> fetch stored vendor
   ├── /activity         -> get activity log
   └── /health           -> "IntelliBoard API ✅"
Services
   ├── OCR/Parsing      -> pdf-parse (offline), regex fallback
   ├── OpenAI (optional) -> field normalization & summarization
   ├── Privacy Module   -> PII detection, masking, risk assessment
   └── Watchlist        -> local JSON of names/entities (offline)
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key (optional - system works offline without it)

### 1. Backend Setup

```bash
cd server/api-server
npm install
```

Create `.env` file:
```bash
OPENAI_API_KEY=your_openai_api_key_here
PORT=4000
MODEL=gpt-3.5-turbo
```

**Note**: If you don't have an OpenAI API key, the system will work in offline mode using regex extraction. Just create the `.env` file without the `OPENAI_API_KEY` line.

### 2. Frontend Setup

```bash
cd server
npm install
```

Create `.env` file:
```bash
VITE_API_URL=http://localhost:4000
```

### 3. Run the Application

**Terminal 1 - Backend:**
```bash
cd server/api-server
npm run dev
```

You should see:
```
🚀 IntelliBoard API listening on http://localhost:4000
📊 OpenAI available: ✅ Yes (or ❌ No if offline mode)
```

**Terminal 2 - Frontend:**
```bash
cd server
npm run dev
```

You should see:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### 4. Access the Application

Open your browser and navigate to: **http://localhost:5173**

## Using Kaggle Datasets for Training

IntelliBoard supports integration with Kaggle datasets to improve training and validation. See [server/api-server/datasets/README.md](server/api-server/datasets/README.md) for detailed instructions.

### Quick Start:

1. **Install Kaggle API**:
   ```bash
   pip install kaggle
   ```

2. **Set up credentials** (download `kaggle.json` from your Kaggle account):
   ```bash
   mkdir -p ~/.kaggle
   cp kaggle.json ~/.kaggle/
   chmod 600 ~/.kaggle/kaggle.json
   ```

3. **Download a dataset**:
   ```bash
   cd server/api-server/datasets
   node download-dataset.js vendor-management
   ```

4. **Process the dataset**:
   ```bash
   node process-dataset.js raw/vendor-data.csv
   ```

5. **Use in application**:
   - Access via API: `GET /datasets/training`
   - Seed database: `POST /datasets/seed`
   - Get benchmark: `GET /datasets/benchmark`

The processed datasets will be used for:
- Training risk scoring models
- Validating extraction accuracy
- Benchmarking system performance
- Populating test data

## Usage

1. **Upload Document**: Click "Upload Document" and select a PDF file
2. **Review Extracted Fields**: The AI will automatically extract business name, registration number, address, and entity type
3. **Edit Fields**: You can manually edit any extracted field if needed
4. **Calculate Risk Score**: Click "Approve" to calculate the risk score
5. **Review Assessment**: View the risk score, assessment checks, and explainability in the right panel

## API Endpoints

### POST /extract
Upload a document and extract vendor fields.

**Request:**
- `multipart/form-data` with `file` field

**Response:**
```json
{
  "fileId": "abc123",
  "filename": "vendor-doc.pdf",
  "extracted": {
    "businessName": "Acme Technologies Inc",
    "registrationNo": "98-7654321",
    "address": "123 Main St. Springfield, IL 62701",
    "entityType": "Limited Liability Company"
  }
}
```

### POST /risk/score
Calculate risk score for extracted fields using AI-powered algorithmic analysis (primary) or rule-based scoring (fallback).

**Request:**
```json
{
  "fields": {
    "businessName": "Acme Technologies Inc",
    "registrationNo": "98-7654321",
    "address": "123 Main St. Springfield, IL 62701",
    "entityType": "Limited Liability Company"
  },
  "documentText": "optional: original document text for context"
}
```

**Note:** If OpenAI API key is available, the system uses AI-powered algorithmic risk analysis that considers multiple weighted factors (information completeness, document authenticity, business legitimacy, watchlist status, data quality). If OpenAI is unavailable, it falls back to rule-based scoring.

**Response:**
```json
{
  "score": 42,
  "band": "Medium",
  "reasons": [
    "Vendor is unlisted in watchlists",
    "Financial history unavailable"
  ],
  "checks": [
    { "label": "Registration number format valid", "status": "ok" },
    { "label": "Address validated", "status": "ok" },
    { "label": "Vendor is unlisted in watchlists", "status": "ok" },
    { "label": "Financial history unavailable", "status": "warn" }
  ]
}
```

### GET /activity
Get activity log.

**Response:**
```json
[
  {
    "id": "abc123",
    "actor": "system",
    "type": "upload",
    "vendorId": null,
    "payload": { "filename": "doc.pdf" },
    "at": "2025-01-XX..."
  }
]
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "message": "IntelliBoard API ✅",
  "openaiAvailable": true,
  "timestamp": "2025-01-XX..."
}
```

## Offline Mode

The system works completely offline:

- **OCR**: Uses `pdf-parse` library for PDF text extraction
- **Field Extraction**: Uses regex patterns to extract vendor information
- **Watchlist**: Local in-memory watchlist for risk checking
- **Risk Scoring**: Deterministic rule-based scoring

When OpenAI is available, the system automatically uses it for better field normalization and extraction accuracy.

## Risk Scoring Logic

The risk score (0-100) is calculated based on:

- **+15**: Registration number format valid
- **+20**: Address validated
- **+20**: Vendor not in watchlist
- **-20**: Financial history unavailable (stub)
- **+5**: Entity type present
- **+5**: Business name present

**Risk Bands:**
- **Low**: 80-100
- **Medium**: 50-79
- **High**: 0-49

## Demo Resilience

The system is designed to work reliably for demos:

- ✅ Works offline with local watchlist + OCR
- ✅ Escalates to OpenAI for normalization when available
- ✅ Graceful error handling
- ✅ Fast response times (<3s extraction, <1s scoring)
- ✅ No hard-coded data; works on any similar document
- ✅ All changes appear in activity log

## Project Structure

```
HackUtd_GS_IntelliBoard_Project2025/
  server/
    api-server/
      index.js          # Express server with API endpoints
      llm.js            # OpenAI integration with offline fallback
      risk.js           # Risk scoring engine
      watchlist.js      # Local watchlist service
      text-extract.js   # OCR and text extraction
      memorydb.js       # In-memory database
      package.json
    src/
      App.tsx           # Main React component
      App.css           # Styling
      index.css         # Global styles
      main.tsx          # React entry point
    package.json
  README.md
```

## Troubleshooting

**Backend won't start:**
- Check that port 4000 is not in use
- Verify `.env` file exists in `server/api-server/`
- Run `npm install` in `server/api-server/`

**Frontend can't connect:**
- Ensure backend is running on port 4000
- Check `VITE_API_URL` in `server/.env`
- Check browser console for CORS errors

**Document extraction fails:**
- Ensure PDF is not password-protected
- Try a simpler PDF document
- Check backend logs for error messages

**OpenAI errors:**
- Verify API key is correct in `.env`
- Check API key has credits
- System will fall back to offline mode automatically

## License

Prototype for HackUTD 2025