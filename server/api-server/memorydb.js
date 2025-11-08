import { nanoid } from "nanoid";
import { scoreVendor } from "./risk.js";

const seed = [
  { name:"Nova FinTech LLC", email:"ops@novafintech.com", country:"US", bank:"First National Bank", address:"345 Harbor Ave, Jersey City, NJ", taxId:"US-98-712349" },
  { name:"SkyBlue Imports", email:"contact@skyblue.io", country:"UK", bank:"Barclays", address:"12 Fleet St, London", taxId:"UK-1234567" },
  { name:"Harbor Analytics", email:"info@harbor.ai", country:"CA", bank:"RBC", address:"101 Bay St, Toronto", taxId:"CA-981232" }
].map((b)=>{ const risk = scoreVendor(b); return { id:nanoid(8), risk, status:risk>=80?"Approved":risk>=50?"Review":"High Risk", ...b }; });

export const db = {
  vendors: seed,
  reviews: [
    { id:101, vendor:"Zenith Partners", type:"KYC match", priority:"High", status:"Open" },
    { id:102, vendor:"Global Apex Pte", type:"Bank account check", priority:"Medium", status:"Open" }
  ],
  activity: [{ t:new Date().toISOString(), msg:"Seed loaded" }]
};
export function addActivity(msg){ db.activity.unshift({ t:new Date().toISOString(), msg }); }
