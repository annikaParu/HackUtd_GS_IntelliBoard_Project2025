// index.js
// IntelliBoard API Server with offline support

import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { nanoid } from "nanoid";
import { scoreVendor, explainVendor, scoreRisk } from "./risk.js";
import { db, addActivity } from "./memorydb.js";
import { extractTextFromUpload } from "./text-extract.js";
import { llmExtractFieldsJSON, llmExtractFieldsJSONLegacy, llmAnswer, isOpenAIReady, llmAnalyzeRisk } from "./llm.js";
import { checkWatchlist } from "./watchlist.js";
import { analyzeDocumentPrivacy, maskExtractedFields } from "./privacy.js";
import { loadProcessedDatasets, getTrainingData, getBenchmarkDataset, seedDatabaseWithDataset } from "./datasets/dataset-loader.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// Health check
app.get("/", (_, res) => res.send("IntelliBoard API ✅"));

// Health endpoint with status
app.get("/health", (req, res) => {
  const datasets = loadProcessedDatasets();
  res.json({ 
    status: "ok", 
    message: "IntelliBoard API ✅",
    openaiAvailable: isOpenAIReady(),
    datasetsLoaded: datasets.length,
    timestamp: new Date().toISOString()
  });
});

// GET /datasets/training - Get training data from processed datasets
app.get("/datasets/training", (req, res) => {
  try {
    const { limit, withRiskScores, shuffle } = req.query;
    const trainingData = getTrainingData({
      limit: limit ? parseInt(limit) : null,
      withRiskScores: withRiskScores === 'true',
      shuffle: shuffle === 'true'
    });
    
    res.json({
      count: trainingData.length,
      data: trainingData
    });
  } catch (error) {
    console.error("Error getting training data:", error);
    res.status(500).json({ error: "Failed to load training data", message: error.message });
  }
});

// GET /datasets/benchmark - Get benchmark dataset for testing
app.get("/datasets/benchmark", (req, res) => {
  try {
    const size = parseInt(req.query.size) || 100;
    const benchmark = getBenchmarkDataset(size);
    
    res.json({
      count: benchmark.length,
      data: benchmark
    });
  } catch (error) {
    console.error("Error getting benchmark data:", error);
    res.status(500).json({ error: "Failed to load benchmark data", message: error.message });
  }
});

// POST /datasets/seed - Seed database with dataset vendors
app.post("/datasets/seed", (req, res) => {
  try {
    const { limit } = req.body || {};
    const count = seedDatabaseWithDataset(db, limit || 50);
    
    res.json({
      success: true,
      vendorsAdded: count,
      message: `Seeded database with ${count} vendors from dataset`
    });
  } catch (error) {
    console.error("Error seeding database:", error);
    res.status(500).json({ error: "Failed to seed database", message: error.message });
  }
});

// Legacy endpoints (keep for backward compatibility)
app.get("/api/vendors", (req, res) => res.json(db.vendors));

app.post("/api/vendors", (req, res) => {
  const { name, email, country, bank, address, taxId } = req.body || {};
  const id = nanoid(8);
  const v = { id, name, email, country, bank, address, taxId };
  v.risk = scoreVendor(v);
  v.status = v.risk >= 80 ? "Approved" : v.risk >= 50 ? "Review" : "High Risk";
  db.vendors.unshift(v);
  addActivity(`New vendor: ${v.name} (${v.status}, risk ${v.risk})`);
  res.status(201).json(v);
});

app.get("/api/vendors/:id/explain", (req, res) => {
  const v = db.vendors.find(x => x.id === req.params.id);
  if (!v) return res.status(404).json({ error: "Not found" });
  res.json(explainVendor(v));
});

app.post("/api/ai/extract", upload.single("file"), async (req, res) => {
  try {
    const text = await extractTextFromUpload(req.file);
    addActivity(`File uploaded: ${req.file?.originalname || "document"} (${text.length} chars)`);
    const fields = await llmExtractFieldsJSONLegacy(text);
    res.json({ text, fields });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "extract_failed", message: e.message });
  }
});

app.post("/api/ai/ask", async (req, res) => {
  const { text, question } = req.body || {};
  if (!text || !question) return res.status(400).json({ error: "text_and_question_required" });
  try {
    const answer = await llmAnswer(text, question);
    addActivity(`AI answered: ${question.slice(0, 60)}…`);
    res.json({ answer });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "qa_failed", message: e.message });
  }
});

// Spec-compliant endpoints
// POST /extract - Extract fields from uploaded document
app.post("/extract", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    console.log(`📄 Processing file: ${req.file.originalname} (${req.file.size} bytes, ${req.file.mimetype})`);

    // Extract text from PDF
    const text = await extractTextFromUpload(req.file);
    console.log(`✅ Extracted ${text.length} characters from PDF`);

    if (!text || text.length < 10) {
      throw new Error("Failed to extract meaningful text from document");
    }

    const fileId = nanoid();

    addActivity({
      actor: "system",
      type: "upload",
      vendorId: null,
      payload: { filename: req.file.originalname, size: req.file.size },
      at: new Date().toISOString()
    });

    // Privacy Analysis - Detect PII in document
    console.log(`🔒 Analyzing document for PII...`);
    const privacyAnalysis = analyzeDocumentPrivacy(text);
    console.log(`🔒 Privacy analysis: ${privacyAnalysis.hasPII ? `PII detected (${privacyAnalysis.piiCount} instances)` : 'No PII detected'}`);

    // Extract fields using LLM (works offline, escalates to OpenAI if available)
    console.log(`🤖 Extracting fields using ${isOpenAIReady() ? "OpenAI" : "offline regex"}...`);
    const extracted = await llmExtractFieldsJSON(text);
    console.log(`✅ Extracted fields:`, extracted);

    // Validate extracted fields
    if (!extracted || typeof extracted !== 'object') {
      throw new Error("Failed to extract fields from document");
    }

    // Ensure all required fields exist
    const normalizedExtracted = {
      businessName: extracted.businessName || extracted.name || "",
      registrationNo: extracted.registrationNo || extracted.registrationNumber || extracted.taxId || "",
      address: extracted.address || "",
      entityType: extracted.entityType || extracted.type || ""
    };

    // Mask PII in extracted fields
    const maskedResult = maskExtractedFields(normalizedExtracted);

    addActivity({
      actor: "system",
      type: "extract",
      vendorId: null,
      payload: { 
        fileId, 
        extracted: normalizedExtracted, 
        method: isOpenAIReady() ? "openai" : "offline" 
      },
      at: new Date().toISOString()
    });

    res.json({
      fileId,
      filename: req.file.originalname,
      extracted: normalizedExtracted,
      extractedMasked: maskedResult.maskedFields,
      documentText: text,
      privacy: {
        hasPII: privacyAnalysis.hasPII,
        riskLevel: privacyAnalysis.riskLevel,
        detectedTypes: privacyAnalysis.detectedTypes,
        piiCount: privacyAnalysis.piiCount,
        recommendations: privacyAnalysis.recommendations,
        fieldsWithPII: maskedResult.piiDetected
      }
    });
  } catch (e) {
    console.error("❌ Extract error:", e);
    res.status(500).json({ 
      error: "extract_failed", 
      message: e.message || "Failed to extract document. Please ensure the file is a valid PDF with extractable text." 
    });
  }
});

// POST /risk/score - Calculate risk score for extracted fields
// PRIMARY METHOD: Uses LLM algorithmic analysis (if OpenAI available)
// FALLBACK: Rule-based scoring (only if OpenAI unavailable)
app.post("/risk/score", async (req, res) => {
  try {
    const { fields, documentText } = req.body || {};
    if (!fields) {
      return res.status(400).json({ error: "fields required" });
    }

    // Get watchlist information to pass to LLM
    const watchlistInfo = checkWatchlist(fields.businessName);

    // PRIMARY METHOD: Use LLM algorithmic risk analysis if OpenAI is available
    let result = null;
    const openaiReady = isOpenAIReady();
    
    if (openaiReady) {
      console.log("🤖 Using AI-powered algorithmic risk analysis (primary method)...");
      console.log("   Vendor:", fields.businessName || "Unknown");
      try {
        result = await llmAnalyzeRisk(fields, documentText, watchlistInfo);
        if (result) {
          console.log(`✅ AI risk analysis complete: Score ${result.score}, Band ${result.band}`);
          console.log(`   Method: AI Algorithmic`);
        } else {
          console.warn("⚠️  LLM returned null result");
        }
      } catch (llmError) {
        console.error("❌ LLM risk analysis error:", llmError.message);
        console.error("   Stack:", llmError.stack);
        // Will fall through to rule-based
      }
    } else {
      console.log("⚠️  OpenAI not available - cannot use AI risk analysis");
    }

    // FALLBACK ONLY: Use rule-based scoring if OpenAI not available or failed
    if (!result) {
      console.log("📊 Using rule-based risk scoring (fallback method)...");
      result = scoreRisk(fields);
      result.method = "rule-based";
      console.log(`📊 Rule-based score: ${result.score}, Band: ${result.band}`);
      console.log("   ⚠️  To use AI-powered scoring, set a valid OPENAI_API_KEY in .env");
    } else {
      result.method = "ai-algorithmic";
    }

    addActivity({
      actor: "system",
      type: "score",
      vendorId: null,
      payload: { 
        score: result.score, 
        band: result.band,
        businessName: fields.businessName,
        method: result.method || "rule-based"
      },
      at: new Date().toISOString()
    });

    res.json(result);
  } catch (e) {
    console.error("Risk score error:", e);
    res.status(500).json({ error: "score_failed", message: e.message });
  }
});

// GET /vendors/:id - Get vendor by ID
app.get("/vendors/:id", (req, res) => {
  const vendor = db.vendors.find(v => v.id === req.params.id);
  if (!vendor) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json(vendor);
});

// Activity log endpoints
app.get("/activity", (req, res) => {
  res.json(db.activity);
});

app.get("/api/activity", (req, res) => res.json(db.activity));
app.get("/api/reviews", (req, res) => res.json(db.reviews));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 IntelliBoard API listening on http://localhost:${PORT}`);
  console.log(`📊 OpenAI available: ${isOpenAIReady() ? "✅ Yes" : "❌ No (offline mode)"}`);
});
