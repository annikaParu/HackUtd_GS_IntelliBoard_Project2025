// memorydb.js
// In-memory database with activity logging

import { nanoid } from "nanoid";
import { scoreVendor } from "./risk.js";

const seed = [
  { name: "Nova FinTech LLC", email: "ops@novafintech.com", country: "US", bank: "First National Bank", address: "345 Harbor Ave, Jersey City, NJ", taxId: "US-98-712349" },
  { name: "SkyBlue Imports", email: "contact@skyblue.io", country: "UK", bank: "Barclays", address: "12 Fleet St, London", taxId: "UK-1234567" },
  { name: "Harbor Analytics", email: "info@harbor.ai", country: "CA", bank: "RBC", address: "101 Bay St, Toronto", taxId: "CA-981232" }
].map((b) => {
  const risk = scoreVendor(b);
  return { id: nanoid(8), risk, status: risk >= 80 ? "Approved" : risk >= 50 ? "Review" : "High Risk", ...b };
});

export const db = {
  vendors: seed,
  reviews: [
    { id: 101, vendor: "Zenith Partners", type: "KYC match", priority: "High", status: "Open" },
    { id: 102, vendor: "Global Apex Pte", type: "Bank account check", priority: "Medium", status: "Open" }
  ],
  activity: [{ 
    id: nanoid(), 
    actor: "system", 
    type: "init", 
    vendorId: null, 
    payload: { message: "System initialized" }, 
    at: new Date().toISOString() 
  }]
};

// Support both old and new activity formats
export function addActivity(activity) {
  let event;
  if (typeof activity === "string") {
    // Legacy format: just a message string
    event = {
      id: nanoid(),
      actor: "system",
      type: "activity",
      vendorId: null,
      payload: { msg: activity },
      at: new Date().toISOString()
    };
  } else {
    // New format: structured object
    event = {
      id: nanoid(),
      ...activity,
      at: activity.at || new Date().toISOString()
    };
  }
  db.activity.unshift(event);
  // Keep only last 100 events
  if (db.activity.length > 100) {
    db.activity = db.activity.slice(0, 100);
  }
  return event;
}
