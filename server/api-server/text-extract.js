// text-extract.js
// Utility for extracting text from uploaded files (PDF or TXT)
// Works offline with OCR fallback

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Extract text from uploaded file using OCR
 * Works offline - no external API calls required
 */
export async function extractTextFromUpload(file) {
  if (!file || !file.mimetype) throw new Error("No file provided");

  const mime = file.mimetype.toLowerCase();

  // --- Handle PDF ---
  if (mime.includes("pdf")) {
    try {
      // Use createRequire to import CommonJS module properly
      const pdfParseModule = require("pdf-parse");
      
      // pdf-parse v2.4.5 uses a class-based API
      // Get the PDFParse class
      const PDFParse = pdfParseModule.PDFParse;
      
      if (!PDFParse || typeof PDFParse !== 'function') {
        console.error("pdf-parse module structure:", Object.keys(pdfParseModule || {}));
        throw new Error(`pdf-parse module did not export PDFParse class. Module type: ${typeof pdfParseModule}`);
      }
      
      console.log("✅ pdf-parse class found, creating instance and extracting text...");
      
      // Create instance with buffer data
      const parser = new PDFParse({ data: file.buffer });
      
      // Get text using the new v2 API
      const result = await parser.getText();
      const extractedText = (result.text || "").trim();
      
      if (!extractedText || extractedText.length < 10) {
        throw new Error("PDF extraction yielded no text - may be image-based PDF or scanned document");
      }
      
      console.log(`✅ Extracted ${extractedText.length} characters from PDF`);
      return extractedText;
    } catch (error) {
      console.error("PDF parsing error:", error);
      console.error("Error stack:", error.stack);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  // --- Handle Images (PNG, JPG, JPEG) ---
  if (mime.includes("image/")) {
    // For MVP, we'll return a placeholder
    // In production, you'd use Tesseract.js or similar OCR library
    throw new Error("Image OCR not yet implemented. Please upload a PDF or text file.");
  }

  // --- Handle Plain Text ---
  if (mime.startsWith("text/")) {
    return file.buffer.toString("utf8").trim();
  }

  // --- Fallback ---
  throw new Error(`Unsupported file type: ${mime}. Please upload PDF or TXT files.`);
}

/**
 * Extract basic fields using regex patterns (offline fallback)
 * This is used when OpenAI is unavailable
 */
export function extractFieldsOffline(text) {
  if (!text || text.length < 10) {
    return {
      businessName: "",
      registrationNo: "",
      address: "",
      entityType: ""
    };
  }

  // Extract business name
  const businessNamePatterns = [
    /(?:company|corporation|llc|ltd|inc|incorporated)[\s:]+([A-Z][A-Za-z\s&.,'-]+?)(?:\n|$|,|\.)/i,
    /([A-Z][A-Za-z\s&.,'-]+?)\s+(?:LLC|Inc\.?|Corporation|Ltd\.?|Incorporated)/i,
    /Business\s+Name[:\s]+([A-Z][A-Za-z\s&.,'-]+?)(?:\n|$)/i,
    /Name[:\s]+([A-Z][A-Za-z\s&.,'-]+?)(?:\n|$)/i
  ];
  
  let businessName = "";
  for (const pattern of businessNamePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      businessName = match[1].trim();
      break;
    }
  }

  // Extract registration number
  const regNoPatterns = [
    /(?:registration|tax|ein|id|number|reg\.?)[\s#:]+([A-Z0-9-]+)/i,
    /(?:EIN|Tax\s+ID|Registration\s+Number)[\s:]+([A-Z0-9-]+)/i,
    /\b(\d{2}-\d{7})\b/, // US format: 98-7654321
    /\b([A-Z]{2}-\d{6,9})\b/, // International format: UK-1234567
    /\b(\d{9,12})\b/ // Generic numeric
  ];
  
  let registrationNo = "";
  for (const pattern of regNoPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      registrationNo = match[1].trim();
      break;
    }
  }

  // Extract address
  const addressPatterns = [
    /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl)[\s,]+[A-Za-z\s,]+(?:[A-Z]{2})?\s*\d{5}(?:-\d{4})?)/i,
    /Address[:\s]+([A-Za-z0-9\s,.-]+(?:[A-Z]{2})?\s*\d{5})/i,
    /(\d+\s+[A-Z][A-Za-z\s]+(?:St|Ave|Rd|Blvd|Dr)[\s,]+[A-Z][A-Za-z\s,]+(?:[A-Z]{2})?\s*\d{5})/i
  ];
  
  let address = "";
  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      address = match[1].trim();
      break;
    }
  }

  // Extract entity type
  let entityType = "";
  if (text.match(/\bLLC\b/i)) {
    entityType = "Limited Liability Company";
  } else if (text.match(/\bInc\.?\b/i) || text.match(/\bIncorporated\b/i)) {
    entityType = "Corporation";
  } else if (text.match(/\bLtd\.?\b/i)) {
    entityType = "Limited Company";
  } else if (text.match(/\bCorporation\b/i)) {
    entityType = "Corporation";
  } else if (text.match(/\bPartnership\b/i)) {
    entityType = "Partnership";
  } else if (text.match(/\bSole\s+Proprietorship\b/i)) {
    entityType = "Sole Proprietorship";
  }

  return {
    businessName: businessName || "",
    registrationNo: registrationNo || "",
    address: address || "",
    entityType: entityType || ""
  };
}
