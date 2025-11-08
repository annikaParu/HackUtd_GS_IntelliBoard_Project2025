import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.MODEL || "gpt-3.5-turbo";

export async function llmExtractFieldsJSON(text){
  const system = "Extract vendor fields as strict JSON with keys: name, taxId, address, email. If unsure, use null.";
  const user = `Document:\n"""${text.slice(0,12000)}"""\nReturn ONLY JSON.`;
  const r = await client.chat.completions.create({
    model: MODEL, temperature: 0.2,
    messages:[{role:"system",content:system},{role:"user",content:user}]
  });
  const raw = r.choices?.[0]?.message?.content?.trim() || "{}";
  try { return JSON.parse(raw.replace(/^```json|```$/g,"").replace(/```/g,"")); } catch { return {}; }
}

export async function llmAnswer(text, question){
  const system = "Answer strictly from the provided document text. If unknown, say you don't know.";
  const r = await client.chat.completions.create({
    model: MODEL, temperature: 0.2,
    messages:[
      {role:"system",content:system},
      {role:"user",content:`Document:\n"""${text.slice(0,12000)}"""\n\nQuestion: ${question}`}
    ]
  });
  return r.choices?.[0]?.message?.content?.trim() || "";
}
