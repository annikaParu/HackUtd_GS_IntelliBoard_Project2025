import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { nanoid } from "nanoid";
import { scoreVendor, explainVendor } from "./risk.js";
import { db, addActivity } from "./memorydb.js";
import { extractTextFromUpload } from "./text-extract.js";
import { llmExtractFieldsJSON, llmAnswer } from "./llm.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

app.get("/", (_,res)=>res.send("IntelliBoard API ✅"));

app.get("/api/vendors", (req,res)=>res.json(db.vendors));
app.post("/api/vendors", (req,res)=>{
  const { name, email, country, bank, address, taxId } = req.body||{};
  const id = nanoid(8);
  const v = { id, name, email, country, bank, address, taxId };
  v.risk = scoreVendor(v);
  v.status = v.risk>=80?"Approved":v.risk>=50?"Review":"High Risk";
  db.vendors.unshift(v);
  addActivity(`New vendor: ${v.name} (${v.status}, risk ${v.risk})`);
  res.status(201).json(v);
});

app.get("/api/vendors/:id/explain",(req,res)=>{
  const v = db.vendors.find(x=>x.id===req.params.id);
  if(!v) return res.status(404).json({error:"Not found"});
  res.json(explainVendor(v));
});

app.post("/api/ai/extract", upload.single("file"), async (req,res)=>{
  try{
    const text = await extractTextFromUpload(req.file);
    addActivity(`File uploaded: ${req.file?.originalname||"document"} (${text.length} chars)`);
    const fields = await llmExtractFieldsJSON(text);
    res.json({ text, fields });
  }catch(e){ console.error(e); res.status(500).json({error:"extract_failed"})}
});

app.post("/api/ai/ask", async (req,res)=>{
  const { text, question } = req.body||{};
  if(!text||!question) return res.status(400).json({error:"text_and_question_required"});
  try{
    const answer = await llmAnswer(text, question);
    addActivity(`AI answered: ${question.slice(0,60)}…`);
    res.json({ answer });
  }catch(e){ console.error(e); res.status(500).json({error:"qa_failed"})}
});

app.get("/api/activity",(req,res)=>res.json(db.activity));
app.get("/api/reviews",(req,res)=>res.json(db.reviews));

const PORT = process.env.PORT||4000;
app.listen(PORT,()=>console.log(`API listening on http://localhost:${PORT}`));
