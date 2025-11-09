// watchlist.js
// Local watchlist service for offline operation

// Local watchlist database (in production, this would be a real database)
const LOCAL_WATCHLIST = [
  "fraud corp",
  "fraud corporation",
  "suspicious entity",
  "blacklisted company",
  "sanctioned entity",
  "money laundering",
  "terrorist organization"
];

/**
 * Check if a business name matches any entry in the watchlist
 * Uses fuzzy matching for better detection
 */
export function checkWatchlist(businessName) {
  if (!businessName) return { isListed: false, matches: [] };
  
  const name = businessName.toLowerCase().trim();
  const matches = [];
  
  // Exact match check
  for (const entry of LOCAL_WATCHLIST) {
    if (name.includes(entry.toLowerCase())) {
      matches.push(entry);
    }
  }
  
  // Fuzzy match for common variations
  const fuzzyPatterns = [
    /fraud/i,
    /suspicious/i,
    /blacklist/i,
    /sanction/i
  ];
  
  for (const pattern of fuzzyPatterns) {
    if (pattern.test(name) && !matches.some(m => pattern.test(m))) {
      matches.push("Pattern match: " + pattern.source);
    }
  }
  
  return {
    isListed: matches.length > 0,
    matches
  };
}

/**
 * Add entry to watchlist (for demo purposes)
 */
export function addToWatchlist(entry) {
  if (!LOCAL_WATCHLIST.includes(entry.toLowerCase())) {
    LOCAL_WATCHLIST.push(entry.toLowerCase());
  }
}

/**
 * Get all watchlist entries
 */
export function getWatchlist() {
  return [...LOCAL_WATCHLIST];
}

