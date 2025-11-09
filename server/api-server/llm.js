// llm.js
// OpenAI integration with graceful degradation to offline extraction

import OpenAI from "openai";
import { extractFieldsOffline } from "./text-extract.js";

// Check if OpenAI is available
let client = null;
let isOpenAIAvailable = false;

try {
  if (process.env.OPENAI_API_KEY) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    isOpenAIAvailable = true;
    console.log("✅ OpenAI API configured");
  } else {
    console.log("⚠️  OpenAI API key not found - using offline extraction only");
  }
} catch (error) {
  console.log("⚠️  OpenAI initialization failed - using offline extraction only");
}

const MODEL = process.env.MODEL || "gpt-3.5-turbo";

/**
 * Extract vendor fields from document text
 * Tries OpenAI first, falls back to offline regex extraction
 */
export async function llmExtractFieldsJSON(text) {
  // Try OpenAI if available
  if (isOpenAIAvailable && client) {
    try {
      const system = `You are an expert at extracting vendor registration information from documents. 
Extract the following fields from the document and return ONLY valid JSON (no markdown, no code blocks):
- businessName: The legal business/company name
- registrationNo: Registration number, tax ID, EIN, or similar identifier
- address: Complete business address
- entityType: Type of entity (e.g., "Limited Liability Company", "Corporation", "LLC", "Inc.", etc.)

If a field is not found, use an empty string "". Return ONLY the JSON object, nothing else.`;

      const user = `Document text:\n"""${text.slice(0, 12000)}"""\n\nExtract the vendor registration fields and return JSON only.`;

      const r = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        timeout: 10000 // 10 second timeout
      });

      const raw = r.choices?.[0]?.message?.content?.trim() || "{}";
      // Clean up JSON - remove markdown code blocks if present
      let cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      cleaned = cleaned.replace(/^```\s*/, "").replace(/```\s*$/, "").trim();
      
      const parsed = JSON.parse(cleaned);
      
      // Normalize field names to match spec
      const normalized = {
        businessName: parsed.businessName || parsed.name || parsed.companyName || "",
        registrationNo: parsed.registrationNo || parsed.registrationNumber || parsed.taxId || parsed.ein || "",
        address: parsed.address || parsed.businessAddress || "",
        entityType: parsed.entityType || parsed.type || parsed.entity || ""
      };
      
      console.log("✅ OpenAI extraction successful");
      return normalized;
    } catch (error) {
      console.warn("⚠️  OpenAI extraction failed, falling back to offline:", error.message);
      // Fall through to offline extraction
    }
  }
  
  // Fallback to offline extraction
  console.log("📄 Using offline regex extraction");
  return extractFieldsOffline(text);
}

/**
 * Legacy function for backward compatibility
 */
export async function llmExtractFieldsJSONLegacy(text) {
  if (isOpenAIAvailable && client) {
    try {
      const system = "Extract vendor fields as strict JSON with keys: name, taxId, address, email. If unsure, use null.";
      const user = `Document:\n"""${text.slice(0, 12000)}"""\nReturn ONLY JSON.`;
      const r = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        timeout: 10000
      });
      const raw = r.choices?.[0]?.message?.content?.trim() || "{}";
      try {
        return JSON.parse(raw.replace(/^```json|```$/g, "").replace(/```/g, ""));
      } catch {
        return extractFieldsOffline(text);
      }
    } catch (error) {
      console.warn("OpenAI failed, using offline:", error.message);
      return extractFieldsOffline(text);
    }
  }
  return extractFieldsOffline(text);
}

/**
 * Answer questions about document text
 * Requires OpenAI - returns error if unavailable
 */
export async function llmAnswer(text, question) {
  if (!isOpenAIAvailable || !client) {
    throw new Error("OpenAI API not available for Q&A");
  }
  
  const system = "Answer strictly from the provided document text. If unknown, say you don't know.";
  const r = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Document:\n"""${text.slice(0, 12000)}"""\n\nQuestion: ${question}` }
    ],
    timeout: 10000
  });
  return r.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * Check if OpenAI is available
 */
export function isOpenAIReady() {
  return isOpenAIAvailable;
}
