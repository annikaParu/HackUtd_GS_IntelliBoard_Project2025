// privacy.js
// Privacy module for PII detection and masking

/**
 * Common PII patterns for detection
 */
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  creditCard: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  dateOfBirth: /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](19|20)\d{2}\b/g,
  passport: /\b[A-Z]{1,2}\d{6,9}\b/g,
  driverLicense: /\b[A-Z]{1,2}\d{6,8}\b/g
};

/**
 * Detect PII in text
 */
export function detectPII(text) {
  if (!text || typeof text !== 'string') {
    return { hasPII: false, detectedTypes: [], maskedText: text, piiCount: 0 };
  }

  const detectedTypes = [];
  let maskedText = text;
  let totalPII = 0;

  // Check each PII type
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      detectedTypes.push(type);
      totalPII += matches.length;

      // Mask the PII based on type
      maskedText = maskedText.replace(pattern, (match) => {
        if (type === 'email') {
          const [local, domain] = match.split('@');
          return `${local[0]}***@${domain}`;
        } else if (type === 'phone') {
          return '***-***-' + match.slice(-4);
        } else if (type === 'ssn') {
          return '***-**-' + match.slice(-4);
        } else if (type === 'creditCard') {
          return '****-****-****-' + match.slice(-4);
        } else {
          return '***MASKED***';
        }
      });
    }
  }

  return {
    hasPII: detectedTypes.length > 0,
    detectedTypes,
    maskedText,
    piiCount: totalPII,
    originalText: text
  };
}

/**
 * Mask PII in extracted fields
 */
export function maskExtractedFields(fields) {
  if (!fields || typeof fields !== 'object') {
    return fields;
  }

  const masked = { ...fields };
  const piiDetected = [];

  // Check each field for PII
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string' && value.length > 0) {
      const piiResult = detectPII(value);
      if (piiResult.hasPII) {
        masked[key] = piiResult.maskedText;
        piiDetected.push({
          field: key,
          types: piiResult.detectedTypes,
          count: piiResult.piiCount
        });
      }
    }
  }

  return {
    maskedFields: masked,
    piiDetected,
    hasPII: piiDetected.length > 0
  };
}

/**
 * Check if document text contains PII
 */
export function analyzeDocumentPrivacy(documentText) {
  if (!documentText) {
    return {
      hasPII: false,
      riskLevel: 'low',
      recommendations: []
    };
  }

  const piiResult = detectPII(documentText);
  
  let riskLevel = 'low';
  const recommendations = [];

  if (piiResult.hasPII) {
    // Determine risk level based on PII types and count
    const highRiskTypes = ['ssn', 'creditCard', 'passport', 'driverLicense'];
    const hasHighRiskPII = piiResult.detectedTypes.some(type => highRiskTypes.includes(type));
    
    if (hasHighRiskPII || piiResult.piiCount > 5) {
      riskLevel = 'high';
      recommendations.push('High-risk PII detected. Ensure proper encryption and access controls.');
      recommendations.push('Consider redacting sensitive information before storage.');
    } else if (piiResult.piiCount > 2) {
      riskLevel = 'medium';
      recommendations.push('Multiple PII types detected. Review data handling procedures.');
    } else {
      riskLevel = 'low';
      recommendations.push('PII detected. Ensure compliance with privacy regulations.');
    }

    recommendations.push(`Detected PII types: ${piiResult.detectedTypes.join(', ')}`);
    recommendations.push(`Total PII instances: ${piiResult.piiCount}`);
  } else {
    recommendations.push('No PII detected in document.');
  }

  return {
    hasPII: piiResult.hasPII,
    riskLevel,
    detectedTypes: piiResult.detectedTypes,
    piiCount: piiResult.piiCount,
    recommendations,
    maskedText: piiResult.maskedText
  };
}

