// text-extract.js
// Utility for extracting text from uploaded files (PDF or TXT)

export async function extractTextFromUpload(file) {
    if (!file || !file.mimetype) throw new Error("No file provided");
  
    const mime = file.mimetype.toLowerCase();
  
    // --- Handle PDF ---
    if (mime.includes("pdf")) {
      // dynamically import pdf-parse to support both CJS/ESM environments
      const pdfModule = await import("pdf-parse");
      const pdfParse = pdfModule.default || pdfModule; // fallback for CJS
      const data = await pdfParse(file.buffer);
      return (data.text || "").trim();
    }
  
    // --- Handle Plain Text ---
    if (mime.startsWith("text/")) {
      return file.buffer.toString("utf8").trim();
    }
  
    // --- Fallback ---
    return `UNSUPPORTED_FILE_TYPE(${mime}). Please upload PDF or TXT files.`;
  }
  