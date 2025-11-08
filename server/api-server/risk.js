const tier = c => (["US","CA","DE","UK","SG"].includes(c)?"low":["AE","FR","ES","JP"].includes(c)?"med":"high");

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
