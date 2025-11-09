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

/**
 * Calculate weighted risk score where LOWER scores = LOWER risk
 * Categories:
 * - Compliance Verification: 40% (0-40 points, lower is better)
 * - Financial Health: 25% (0-25 points, lower is better)
 * - Operational Risk: 20% (0-20 points, lower is better)
 * - Reputational Risk: 15% (0-15 points, lower is better)
 * Total: 0-100 where 0-33 = Low Risk, 34-66 = Medium Risk, 67-100 = High Risk
 */
export function scoreRisk(fields, documentText = null) {
  const { businessName, registrationNo, address, entityType } = fields || {};
  const reasons = [];
  const checks = [];
  
  // Initialize category scores (0 = best, max = worst)
  let complianceScore = 0; // Max 40
  let financialScore = 0; // Max 25
  let operationalScore = 0; // Max 20
  let reputationalScore = 0; // Max 15

  // ============================================
  // 1. COMPLIANCE VERIFICATION (40% weight)
  // ============================================
  const complianceChecks = [];
  let compliancePassed = 0;
  let complianceTotal = 0;

  // Check 1: Registration number validation
  complianceTotal++;
  if (validateRegistrationNo(registrationNo)) {
    compliancePassed++;
    complianceChecks.push({ label: "Registration number format valid", status: "ok" });
  } else {
    if (registrationNo && registrationNo.trim()) {
      complianceScore += 10; // Invalid format
      complianceChecks.push({ label: "Registration number format valid", status: "warn" });
      reasons.push("Registration number format invalid");
    } else {
      complianceScore += 15; // Missing
      complianceChecks.push({ label: "Registration number missing", status: "fail" });
      reasons.push("Registration number missing");
    }
  }

  // Check 2: Address validation
  complianceTotal++;
  if (normalizeAddress(address)) {
    compliancePassed++;
    complianceChecks.push({ label: "Address validated", status: "ok" });
  } else {
    if (address && address.trim()) {
      complianceScore += 8; // Invalid format
      complianceChecks.push({ label: "Address validated", status: "warn" });
      reasons.push("Address incomplete or invalid format");
    } else {
      complianceScore += 12; // Missing
      complianceChecks.push({ label: "Address missing", status: "fail" });
      reasons.push("Address missing");
    }
  }

  // Check 3: Business name present
  complianceTotal++;
  if (businessName && businessName.trim()) {
    compliancePassed++;
    complianceChecks.push({ label: "Business name present", status: "ok" });
  } else {
    complianceScore += 8;
    complianceChecks.push({ label: "Business name missing", status: "fail" });
    reasons.push("Business name missing");
  }

  // Check 4: Entity type present
  complianceTotal++;
  if (entityType && entityType.trim()) {
    compliancePassed++;
    complianceChecks.push({ label: "Entity type specified", status: "ok" });
  } else {
    complianceScore += 5;
    complianceChecks.push({ label: "Entity type missing", status: "warn" });
  }

  // Calculate compliance score (0-40, where 0 = all passed, 40 = all failed)
  complianceScore = Math.min(40, complianceScore);
  checks.push(...complianceChecks);

  // ============================================
  // 2. FINANCIAL HEALTH (25% weight)
  // ============================================
  // Analyze financial indicators from document if available
  if (documentText) {
    // Check for financial statement indicators
    const hasRevenue = /revenue|sales|income|turnover/i.test(documentText);
    const hasProfit = /profit|net income|earnings/i.test(documentText);
    const hasLoss = /loss|deficit|negative|bankruptcy/i.test(documentText);
    
    if (hasLoss) {
      financialScore = 25; // High risk - losses detected
      reasons.push("Financial losses or negative indicators detected");
      checks.push({ label: "Financial health assessment", status: "fail" });
    } else if (hasRevenue && hasProfit) {
      financialScore = 5; // Low risk - positive indicators
      checks.push({ label: "Financial health assessment", status: "ok" });
    } else if (hasRevenue) {
      financialScore = 15; // Medium risk - revenue but unclear profitability
      reasons.push("Financial statements incomplete - profitability unclear");
      checks.push({ label: "Financial health assessment", status: "warn" });
    } else {
      financialScore = 20; // Medium-high risk - no financial data
      reasons.push("Financial statements not found in document");
      checks.push({ label: "Financial health assessment", status: "warn" });
    }
  } else {
    // No document text - assume medium risk
    financialScore = 18;
    reasons.push("Financial data unavailable - document analysis required");
    checks.push({ label: "Financial health assessment", status: "warn" });
  }

  // ============================================
  // 3. OPERATIONAL RISK (20% weight)
  // ============================================
  // Geographic risk
  const countryTier = tier(address ? extractCountry(address) : "US");
  if (countryTier === "high") {
    operationalScore += 12;
    reasons.push("High-risk geographic location");
  } else if (countryTier === "med") {
    operationalScore += 6;
    reasons.push("Medium-risk geographic location");
  } else {
    operationalScore += 2; // Low risk countries still have some base risk
  }

  // Industry risk (basic assessment)
  const highRiskIndustries = ['financial services', 'gambling', 'cryptocurrency', 'pharmaceutical'];
  const industryRisk = entityType && highRiskIndustries.some(industry => 
    entityType.toLowerCase().includes(industry)
  );
  if (industryRisk) {
    operationalScore += 8;
    reasons.push("High-risk industry sector");
  } else {
    operationalScore += 2;
  }

  operationalScore = Math.min(20, operationalScore);
  checks.push({ 
    label: `Operational risk: ${countryTier} risk location`, 
    status: countryTier === "high" ? "fail" : countryTier === "med" ? "warn" : "ok" 
  });

  // ============================================
  // 4. REPUTATIONAL RISK (15% weight)
  // ============================================
  // Watchlist check
  const watchlistResult = checkWatchlist(businessName);
  if (watchlistResult.isListed) {
    reputationalScore = 15; // Maximum risk - watchlist match
    reasons.push(`CRITICAL: Vendor matches watchlist entries: ${watchlistResult.matches.join(", ")}`);
    checks.push({ label: "Sanctions & watchlist check", status: "fail" });
  } else {
    reputationalScore = 0; // No watchlist match - good
    reasons.push("Vendor is unlisted in watchlists");
    checks.push({ label: "Sanctions & watchlist check", status: "ok" });
  }

  // Check for legal issues in document
  if (documentText) {
    const hasLegalIssues = /lawsuit|litigation|legal action|court case|sued|violation|penalty|fine/i.test(documentText);
    if (hasLegalIssues) {
      reputationalScore += 5;
      reasons.push("Legal issues or violations mentioned in documents");
    }
  }

  reputationalScore = Math.min(15, reputationalScore);

  // ============================================
  // CALCULATE FINAL WEIGHTED SCORE
  // ============================================
  // Total score: 0-100 where lower = lower risk
  const totalScore = Math.round(complianceScore + financialScore + operationalScore + reputationalScore);
  const finalScore = Math.max(0, Math.min(100, totalScore));

  // Determine risk band
  let band = "Low";
  if (finalScore >= 67) {
    band = "High";
  } else if (finalScore >= 34) {
    band = "Medium";
  }

  // Add category breakdown for transparency
  reasons.push(`Score breakdown: Compliance ${complianceScore}/40, Financial ${financialScore}/25, Operational ${operationalScore}/20, Reputational ${reputationalScore}/15`);

  return {
    score: finalScore,
    band,
    reasons,
    checks,
    breakdown: {
      compliance: { score: complianceScore, max: 40, weight: 40 },
      financial: { score: financialScore, max: 25, weight: 25 },
      operational: { score: operationalScore, max: 20, weight: 20 },
      reputational: { score: reputationalScore, max: 15, weight: 15 }
    }
  };
}

// Helper function to extract country from address
function extractCountry(address) {
  if (!address) return "US";
  
  const countryPatterns = {
    'US': /\b(USA|United States|US)\b/i,
    'CA': /\b(Canada|CA)\b/i,
    'UK': /\b(United Kingdom|UK|England|Scotland|Wales)\b/i,
    'DE': /\b(Germany|DE)\b/i,
    'SG': /\b(Singapore|SG)\b/i,
    'FR': /\b(France|FR)\b/i,
    'ES': /\b(Spain|ES)\b/i,
    'JP': /\b(Japan|JP)\b/i,
    'AE': /\b(UAE|United Arab Emirates|AE)\b/i,
    'SA': /\b(Saudi Arabia|SA)\b/i
  };

  for (const [code, pattern] of Object.entries(countryPatterns)) {
    if (pattern.test(address)) {
      return code;
    }
  }
  
  return "US"; // Default
}
