// risk.js
// Risk scoring engine with watchlist integration

import { checkWatchlist } from "./watchlist.js";

const tier = c => (["US","CA","DE","UK","SG"].includes(c)?"low":["AE","FR","ES","JP"].includes(c)?"med":"high");

// Existing function for vendor objects (legacy)
export function scoreVendor(v) {
  let s = 50;
  const t = tier(v.country||"US");
  if(t==="low") s+=20; if(t==="med") s+=10; if(t==="high") s-=10;
  if(!v.email) s-=5; else if(/@gmail\.com|@yahoo\.com|@outlook\.com/i.test(v.email)) s-=15; else s+=10;
  if(v.address) s+=5; if(v.taxId) s+=5; if(v.bank) s+=5;
  return Math.max(0,Math.min(100,s));
}

export function explainVendor(v){
  const s = scoreVendor(v); const out=[];
  if(s>=80) out.push("Strong match between registration and banking info.");
  if(s<80&&s>=50) out.push("Minor inconsistencies; manual review recommended.");
  if(s<50) out.push("Signals indicate elevated risk.");
  if(/@gmail\.com|@yahoo\.com|@outlook\.com/i.test(v.email||"")) out.push("Personal email domain; request corporate email.");
  out.push(`Country: ${v.country} (tier ${tier(v.country)})`);
  out.push("Prototype: rule-based scoring; swap with ML later.");
  return out;
}

// Validation functions
function validateRegistrationNo(regNo) {
  if (!regNo || !regNo.trim()) return false;
  const trimmed = regNo.trim();
  
  const patterns = [
    /^\d{2}-\d{7}$/, // US: 98-7654321
    /^[A-Z]{2}-\d{6,8}$/, // UK: UK-1234567
    /^[A-Z]{2}-\d{6,9}$/, // CA: CA-981232
    /^\d{9,12}$/, // Generic numeric
    /^[A-Z0-9-]{6,15}$/i // Alphanumeric with dashes (flexible)
  ];
  
  return patterns.some(pattern => pattern.test(trimmed));
}

function normalizeAddress(address) {
  if (!address || !address.trim()) return false;
  const trimmed = address.trim();
  
  // Must have minimum length
  if (trimmed.length < 10) return false;
  
  // Check for street number
  const hasStreet = /\d+\s+[A-Za-z]+/.test(trimmed);
  
  // Check for city/state/zip pattern
  const hasCity = /[A-Za-z]+\s*,\s*[A-Z]{2}/.test(trimmed) || 
                  /[A-Za-z]+\s*,\s*[A-Za-z]+/.test(trimmed) ||
                  /\d{5}/.test(trimmed); // Has zip code
  
  return hasStreet && hasCity;
}

// Spec-compliant risk scoring for extracted fields
export function scoreRisk(fields) {
  let score = 0;
  const reasons = [];
  const checks = [];

  const { businessName, registrationNo, address, entityType } = fields || {};

  // Rule 1: Registration format (+15 if valid)
  if (validateRegistrationNo(registrationNo)) {
    score += 15;
    checks.push({ label: "Registration number format valid", status: "ok" });
  } else {
    if (registrationNo && registrationNo.trim()) {
      reasons.push("Registration number format invalid");
      checks.push({ label: "Registration number format valid", status: "warn" });
    } else {
      reasons.push("Registration number missing");
      checks.push({ label: "Registration number format valid", status: "warn" });
    }
  }

  // Rule 2: Address found & normalized (+20 if valid)
  if (normalizeAddress(address)) {
    score += 20;
    checks.push({ label: "Address validated", status: "ok" });
  } else {
    if (address && address.trim()) {
      reasons.push("Address incomplete or invalid format");
      checks.push({ label: "Address validated", status: "warn" });
    } else {
      reasons.push("Address missing");
      checks.push({ label: "Address validated", status: "warn" });
    }
  }

  // Rule 3: Watchlist check (+20 if clear, -30 if listed)
  const watchlistResult = checkWatchlist(businessName);
  if (!watchlistResult.isListed) {
    score += 20;
    reasons.push("Vendor is unlisted in watchlists");
    checks.push({ label: "Vendor is unlisted in watchlists", status: "ok" });
  } else {
    score -= 30; // Heavy penalty for watchlist match
    reasons.push(`Vendor matches watchlist entries: ${watchlistResult.matches.join(", ")}`);
    checks.push({ label: "Vendor is unlisted in watchlists", status: "fail" });
  }

  // Rule 4: Financial history (-20 if missing) - stub for MVP
  // In production, this would check external financial data sources
  score -= 20;
  reasons.push("Financial history unavailable");
  checks.push({ label: "Financial history unavailable", status: "warn" });

  // Entity type bonus (+5 if present)
  if (entityType && entityType.trim()) {
    score += 5;
  }

  // Business name present (+5 if present)
  if (businessName && businessName.trim()) {
    score += 5;
  } else {
    score -= 10; // Penalty for missing business name
    reasons.push("Business name missing");
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine band
  let band = "Low";
  if (score < 50) {
    band = "High";
  } else if (score < 80) {
    band = "Medium";
  }

  return {
    score,
    band,
    reasons,
    checks
  };
}
