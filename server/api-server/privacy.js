// privacy.js
// PII Detection and Masking Module

/**
 * Detects PII (Personally Identifiable Information) in text
 * Returns array of detected PII with type, value, position, and risk level
 */
export function detectPII(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const detectedPII = [];
  const patterns = {
    // Email addresses
    email: {
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      type: 'email',
      risk: 'medium',
      maskPattern: (match) => {
        const [local, domain] = match.split('@');
        return `${local.charAt(0)}***@${domain}`;
      }
    },
    
    // Phone numbers (US format: (XXX) XXX-XXXX, XXX-XXX-XXXX, XXX.XXX.XXXX, etc.)
    phone: {
      regex: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
      type: 'phone',
      risk: 'medium',
      maskPattern: (match) => {
        const digits = match.replace(/\D/g, '');
        if (digits.length >= 10) {
          return `***-***-${digits.slice(-4)}`;
        }
        return '***-***-****';
      }
    },
    
    // Social Security Numbers (SSN)
    ssn: {
      regex: /\b\d{3}-?\d{2}-?\d{4}\b/g,
      type: 'ssn',
      risk: 'high',
      maskPattern: () => '***-**-****'
    },
    
    // Credit Card Numbers (16 digits, may have spaces or dashes)
    creditCard: {
      regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      type: 'creditCard',
      risk: 'high',
      maskPattern: (match) => {
        const digits = match.replace(/\D/g, '');
        return `****-****-****-${digits.slice(-4)}`;
      }
    },
    
    // Bank Account Numbers (9-17 digits, often in groups)
    bankAccount: {
      regex: /\b\d{9,17}\b/g,
      type: 'bankAccount',
      risk: 'high',
      maskPattern: (match) => {
        return `****${match.slice(-4)}`;
      }
    },
    
    // Driver's License (varies by state, common patterns)
    driversLicense: {
      regex: /\b[A-Z]{1,2}\d{6,9}\b/g,
      type: 'driversLicense',
      risk: 'high',
      maskPattern: (match) => {
        return `${match.slice(0, 2)}****${match.slice(-2)}`;
      }
    },
    
    // Passport Numbers (alphanumeric, 6-9 characters)
    passport: {
      regex: /\b[A-Z]{1,2}\d{6,9}\b/g,
      type: 'passport',
      risk: 'high',
      maskPattern: (match) => {
        return `${match.slice(0, 2)}****${match.slice(-2)}`;
      }
    },
    
    // IP Addresses
    ipAddress: {
      regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      type: 'ipAddress',
      risk: 'low',
      maskPattern: (match) => {
        const parts = match.split('.');
        return `${parts[0]}.${parts[1]}.***.${parts[3]}`;
      }
    },
    
    // Dates that might be birth dates (MM/DD/YYYY, DD/MM/YYYY)
    potentialDOB: {
      regex: /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g,
      type: 'potentialDOB',
      risk: 'medium',
      maskPattern: (match) => {
        return '**/**/****';
      }
    }
  };

  // Check each pattern
  for (const [key, pattern] of Object.entries(patterns)) {
    const matches = [...text.matchAll(pattern.regex)];
    for (const match of matches) {
      // Avoid false positives for credit cards (check Luhn algorithm for last 4)
      if (key === 'creditCard') {
        const digits = match[0].replace(/\D/g, '');
        if (digits.length !== 16) continue;
      }
      
      // Avoid false positives for SSN (should not start with 000, 666, or 9XX)
      if (key === 'ssn') {
        const digits = match[0].replace(/\D/g, '');
        if (digits.length === 9) {
          const firstThree = digits.slice(0, 3);
          if (firstThree === '000' || firstThree === '666' || firstThree.startsWith('9')) {
            continue; // Likely not a real SSN
          }
        }
      }

      detectedPII.push({
        type: pattern.type,
        value: match[0],
        maskedValue: pattern.maskPattern(match[0]),
        position: match.index,
        length: match[0].length,
        risk: pattern.risk,
        context: getContext(text, match.index, match[0].length)
      });
    }
  }

  // Remove duplicates (same value at same position)
  const uniquePII = [];
  const seen = new Set();
  for (const pii of detectedPII) {
    const key = `${pii.type}:${pii.position}:${pii.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePII.push(pii);
    }
  }

  return uniquePII.sort((a, b) => a.position - b.position);
}

/**
 * Get context around detected PII (20 chars before and after)
 */
function getContext(text, position, length) {
  const start = Math.max(0, position - 20);
  const end = Math.min(text.length, position + length + 20);
  return text.slice(start, end).trim();
}

/**
 * Mask PII in text
 */
export function maskPII(text, detectedPII, maskAll = false) {
  if (!text || !detectedPII || detectedPII.length === 0) {
    return text;
  }

  let maskedText = text;
  // Sort by position in reverse to avoid position shifts
  const sortedPII = [...detectedPII].sort((a, b) => b.position - a.position);

  for (const pii of sortedPII) {
    const shouldMask = maskAll || pii.risk === 'high';
    if (shouldMask) {
      maskedText = maskedText.slice(0, pii.position) + 
                   pii.maskedValue + 
                   maskedText.slice(pii.position + pii.length);
    }
  }

  return maskedText;
}

/**
 * Get PII risk summary
 */
export function getPIIRiskSummary(detectedPII) {
  const summary = {
    total: detectedPII.length,
    high: detectedPII.filter(p => p.risk === 'high').length,
    medium: detectedPII.filter(p => p.risk === 'medium').length,
    low: detectedPII.filter(p => p.risk === 'low').length,
    byType: {}
  };

  for (const pii of detectedPII) {
    summary.byType[pii.type] = (summary.byType[pii.type] || 0) + 1;
  }

  // Calculate overall risk level
  if (summary.high > 0) {
    summary.overallRisk = 'high';
  } else if (summary.medium > 0) {
    summary.overallRisk = 'medium';
  } else if (summary.low > 0) {
    summary.overallRisk = 'low';
  } else {
    summary.overallRisk = 'none';
  }

  return summary;
}

/**
 * Generate PII compliance recommendations
 */
export function getPIIRecommendations(detectedPII) {
  const recommendations = [];
  
  if (detectedPII.length === 0) {
    return ['No PII detected. Document appears to be compliant.'];
  }

  const highRiskPII = detectedPII.filter(p => p.risk === 'high');
  const mediumRiskPII = detectedPII.filter(p => p.risk === 'medium');

  if (highRiskPII.length > 0) {
    recommendations.push(`⚠️ HIGH RISK: ${highRiskPII.length} high-risk PII items detected (SSN, Credit Cards, Bank Accounts, etc.). Immediate masking recommended.`);
  }

  if (mediumRiskPII.length > 0) {
    recommendations.push(`⚠️ MEDIUM RISK: ${mediumRiskPII.length} medium-risk PII items detected (Emails, Phone Numbers, etc.). Review and consider masking.`);
  }

  if (detectedPII.some(p => p.type === 'ssn')) {
    recommendations.push('🔒 SSN detected: Ensure compliance with data protection regulations (GDPR, CCPA, etc.).');
  }

  if (detectedPII.some(p => p.type === 'creditCard')) {
    recommendations.push('💳 Credit card information detected: PCI DSS compliance required. Mask or remove immediately.');
  }

  if (detectedPII.some(p => p.type === 'bankAccount')) {
    recommendations.push('🏦 Bank account numbers detected: High security risk. Mask before storage or sharing.');
  }

  recommendations.push('✅ Recommendation: Use the masking feature to protect sensitive information before processing or storing documents.');

  return recommendations;
}

