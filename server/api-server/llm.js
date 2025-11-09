// llm.js
// OpenAI integration with graceful degradation to offline extraction

import OpenAI from "openai";
import { extractFieldsOffline } from "./text-extract.js";

// Check if OpenAI is available
let client = null;
let isOpenAIAvailable = false;

try {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey.trim() && !apiKey.includes("your_openai_api_key") && apiKey.length > 20) {
    client = new OpenAI({ apiKey: apiKey.trim() });
    isOpenAIAvailable = true;
    console.log("✅ OpenAI API configured");
  } else {
    isOpenAIAvailable = false;
    console.log("⚠️  OpenAI API key not found or invalid - using offline mode only");
    console.log("   Set OPENAI_API_KEY in .env file to enable AI-powered risk assessment");
  }
} catch (error) {
  isOpenAIAvailable = false;
  console.log("⚠️  OpenAI initialization failed - using offline extraction only");
  console.log("   Error:", error.message);
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
        ]
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
        messages: [{ role: "system", content: system }, { role: "user", content: user }]
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
    ]
  });
  return r.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * Analyze risk/trust score using OpenAI based on extracted vendor information
 * Returns a risk assessment with score, band, reasons, and checks
 * This is the PRIMARY risk scoring method - uses algorithmic AI analysis
 */
export async function llmAnalyzeRisk(fields, documentText = null, watchlistInfo = null) {
  if (!isOpenAIAvailable || !client) {
    console.log("⚠️  OpenAI not available - cannot use AI risk analysis");
    return null; // Signal to use fallback
  }

  try {
    const { businessName, registrationNo, address, entityType } = fields || {};

    const system = `You are an expert risk analyst for vendor onboarding and due diligence. Your task is to DESIGN YOUR OWN ALGORITHM to determine the trustworthiness and risk level of a vendor.

**CRITICAL: You must create your own algorithmic approach. Do NOT follow a template or hard-coded rules.**

Analyze the vendor information and:
1. **Design your own risk assessment algorithm** - determine what factors matter most for THIS specific vendor
2. **Calculate a risk score (0-100)** where higher scores = higher risk, lower scores = lower risk (more trustworthy)
3. **Use your own reasoning** - consider patterns, inconsistencies, completeness, legitimacy signals, watchlist status, and any other factors YOU determine are relevant
4. **Be creative and nuanced** - don't just check boxes, actually reason about the data
5. **Consider interrelationships** - how do the fields relate to each other? Are there inconsistencies?
6. **Weight factors dynamically** - what matters most for THIS vendor might be different than another

**Your algorithm should:**
- Start from scratch for each vendor (no fixed baseline)
- Identify what's most important for THIS specific case
- Consider context from document text if provided
- Detect subtle red flags or positive signals
- Provide detailed reasoning for your score

Return ONLY a valid JSON object:
{
  "score": <number 0-100, YOUR algorithmic calculation, where higher = higher risk>,
  "band": "Low" | "Medium" | "High" (0-30=Low risk, 31-60=Medium risk, 61-100=High risk),
  "reasons": [<array of strings explaining YOUR algorithmic reasoning - be specific about how YOU calculated this>],
  "checks": [
    {"label": "<what YOU checked>", "status": "ok" | "warn" | "fail"}
  ]
}

The "reasons" should explain YOUR algorithm - what factors YOU considered, how YOU weighted them, and why YOU arrived at this specific score. Be detailed and specific.`;

    const watchlistSection = watchlistInfo 
      ? `\n**Watchlist Status:** ${watchlistInfo.isListed ? `⚠️ LISTED - Matches: ${watchlistInfo.matches.join(", ")}` : "✅ Not listed in watchlists"}`
      : "";

    const userContent = `Analyze this vendor and design your own algorithm to determine their risk/trust score.

**Vendor Data:**
- Business Name: ${businessName || "Not provided"}
- Registration Number: ${registrationNo || "Not provided"}
- Address: ${address || "Not provided"}
- Entity Type: ${entityType || "Not provided"}
${watchlistSection}

${documentText ? `\n**Document Context:**\n${documentText.slice(0, 5000)}` : ""}

**Your Task:**
Design your own risk assessment algorithm for THIS vendor. Don't follow templates - use your reasoning to:
- Determine what factors are most important here
- Calculate a risk score (0-100) using YOUR algorithm
- Explain exactly how YOU arrived at this score
- Identify specific checks that matter for this vendor

Think like a risk analyst would - what would make YOU trust or distrust this vendor?`;

    console.log(`🤖 Calling OpenAI ${MODEL} for risk analysis...`);

    const supportsJsonMode = MODEL.includes('gpt-4') || MODEL.includes('gpt-3.5-turbo-1106') || MODEL.includes('gpt-3.5-turbo-0125');
    
    const requestOptions = {
      model: MODEL,
      temperature: 0.4, // Higher temperature for more creative, non-template algorithmic reasoning
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent }
      ]
    };

    if (supportsJsonMode) {
      requestOptions.response_format = { type: "json_object" };
      requestOptions.messages[0].content = system + "\n\nIMPORTANT: Return ONLY valid JSON. Design your own algorithm - do not use templates or hard-coded rules. Calculate the score using YOUR reasoning.";
    }

    const response = await client.chat.completions.create(requestOptions);
    const raw = response.choices?.[0]?.message?.content?.trim() || "{}";

    // Clean up JSON
    let cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .replace(/^```\s*/, "")
      .replace(/```\s*$/, "")
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned);

    // Validate and normalize the response - but preserve LLM's algorithmic reasoning
    const score = Math.max(0, Math.min(100, parsed.score || 50));
    // Let LLM determine the band, but validate it
    // Higher score = Higher risk, so: 0-30 = Low, 31-60 = Medium, 61-100 = High
    let band = parsed.band;
    if (!band || !["Low", "Medium", "High"].includes(band)) {
      // Only fallback to auto-calculation if LLM didn't provide band
      band = score <= 30 ? "Low" : score <= 60 ? "Medium" : "High";
    }
    const reasons = Array.isArray(parsed.reasons) ? parsed.reasons : [];
    const checks = Array.isArray(parsed.checks) ? parsed.checks : [];

    // Only add a default check if LLM provided none - trust the LLM's algorithm
    if (checks.length === 0 && reasons.length === 0) {
      checks.push(
        { label: "AI Algorithmic Risk Analysis", status: score >= 70 ? "ok" : score >= 40 ? "warn" : "fail" }
      );
    }

    console.log(`✅ OpenAI risk analysis complete: Score ${score}, Band ${band}`);
    
    return {
      score,
      band,
      reasons,
      checks,
      method: "openai"
    };
  } catch (error) {
    console.error("❌ OpenAI risk analysis failed:", error.message);
    console.error("   Error details:", error);
    console.warn("⚠️  Falling back to rule-based scoring");
    return null; // Signal to use fallback
  }
}

/**
 * Check if OpenAI is available
 */
export function isOpenAIReady() {
  return isOpenAIAvailable;
}
