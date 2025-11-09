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
import { llmExtractFieldsJSON, llmExtractFieldsJSONLegacy, llmAnswer, isOpenAIReady } from "./llm.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// Health check
app.get("/", (_, res) => res.send("IntelliBoard API ✅"));

// Health endpoint with status
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "IntelliBoard API ✅",
    openaiAvailable: isOpenAIReady(),
    timestamp: new Date().toISOString()
  });
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

    const text = await extractTextFromUpload(req.file);
    const fileId = nanoid();

    addActivity({
      actor: "system",
      type: "upload",
      vendorId: null,
      payload: { filename: req.file.originalname, size: req.file.size },
      at: new Date().toISOString()
    });

    // Extract fields (works offline, escalates to OpenAI if available)
    const extracted = await llmExtractFieldsJSON(text);

    addActivity({
      actor: "system",
      type: "extract",
      vendorId: null,
      payload: { fileId, extracted, method: isOpenAIReady() ? "openai" : "offline" },
      at: new Date().toISOString()
    });

    res.json({
      fileId,
      filename: req.file.originalname,
      extracted
    });
  } catch (e) {
    console.error("Extract error:", e);
    res.status(500).json({ error: "extract_failed", message: e.message });
  }
});

// POST /risk/score - Calculate risk score for extracted fields
app.post("/risk/score", async (req, res) => {
  try {
    const { fields } = req.body || {};
    if (!fields) {
      return res.status(400).json({ error: "fields required" });
    }

    const result = scoreRisk(fields);

    addActivity({
      actor: "system",
      type: "score",
      vendorId: null,
      payload: { 
        score: result.score, 
        band: result.band,
        businessName: fields.businessName 
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
