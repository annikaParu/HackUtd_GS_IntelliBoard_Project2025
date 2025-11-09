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
      const system = `You are an expert at extracting vendor registration information from business documents, contracts, and registration forms.

Your task is to extract vendor information and return ONLY a valid JSON object with these exact keys:
- businessName: The legal business/company name (required)
- registrationNo: Registration number, tax ID, EIN, or similar identifier
- address: Complete business address including street, city, state, zip
- entityType: Type of entity (e.g., "Limited Liability Company", "Corporation", "LLC", "Inc.", "Partnership", etc.)

IMPORTANT:
- Return ONLY valid JSON, no markdown, no code blocks, no explanations
- If a field is not found, use an empty string ""
- Extract the most complete information available
- For businessName, use the official registered name
- For registrationNo, look for EIN, Tax ID, Registration Number, or similar
- For address, include the full address if available
- For entityType, identify the legal structure (LLC, Corporation, etc.)

Example output format:
{"businessName": "Acme Technologies Inc", "registrationNo": "98-7654321", "address": "123 Main St, Springfield, IL 62701", "entityType": "Limited Liability Company"}`;

      const user = `Extract vendor registration information from this document:

${text.slice(0, 15000)}

Return ONLY the JSON object with businessName, registrationNo, address, and entityType.`;

      console.log(`🔍 Calling OpenAI ${MODEL} for field extraction...`);
      
      // Use JSON mode if model supports it (gpt-4o, gpt-4-turbo, gpt-3.5-turbo-1106+)
      const supportsJsonMode = MODEL.includes('gpt-4') || MODEL.includes('gpt-3.5-turbo-1106') || MODEL.includes('gpt-3.5-turbo-0125');
      
      const requestOptions = {
        model: MODEL,
        temperature: 0.1, // Lower temperature for more consistent extraction
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        timeout: 30000 // 30 second timeout for larger documents
      };

      // Add response_format for JSON mode if supported
      if (supportsJsonMode) {
        requestOptions.response_format = { type: "json_object" };
        // Update system prompt to mention JSON format
        requestOptions.messages[0].content = system + "\n\nYou must return a valid JSON object.";
      }
      
      const r = await client.chat.completions.create(requestOptions);

      const raw = r.choices?.[0]?.message?.content?.trim() || "{}";
      console.log(`📝 Raw LLM response (first 200 chars):`, raw.slice(0, 200));
      
      // Clean up JSON - remove markdown code blocks if present
      let cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/i, "")
        .replace(/^```\s*/, "")
        .replace(/```\s*$/, "")
        .trim();
      
      // Try to find JSON object if wrapped in text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
      
      const parsed = JSON.parse(cleaned);
      console.log(`✅ Parsed JSON:`, parsed);
      
      // Normalize field names to match spec
      const normalized = {
        businessName: parsed.businessName || parsed.name || parsed.companyName || parsed.business_name || "",
        registrationNo: parsed.registrationNo || parsed.registrationNumber || parsed.registration_no || parsed.taxId || parsed.tax_id || parsed.ein || parsed.EIN || "",
        address: parsed.address || parsed.businessAddress || parsed.business_address || parsed.fullAddress || "",
        entityType: parsed.entityType || parsed.entity_type || parsed.type || parsed.entity || parsed.legalStructure || ""
      };
      
      console.log("✅ OpenAI extraction successful:", normalized);
      return normalized;
    } catch (error) {
      console.warn("⚠️  OpenAI extraction failed, falling back to offline:", error.message);
      console.error("OpenAI error details:", error);
      // Fall through to offline extraction
    }
  }
  
  // Fallback to offline extraction
  console.log("📄 Using offline regex extraction");
  const offlineResult = extractFieldsOffline(text);
  console.log("📄 Offline extraction result:", offlineResult);
  return offlineResult;
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
