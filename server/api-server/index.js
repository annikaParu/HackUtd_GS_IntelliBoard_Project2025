// server/api-server/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const MODEL = process.env.MODEL || 'gpt-4o-mini';

// Basic health
app.get('/', (_req, res) => {
  res.type('text').send('IntelliBoard API ✅');
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    hasKey: Boolean(process.env.OPENAI_API_KEY),
  });
});

// --- Ping OpenAI once to prove connectivity ---
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get('/api/ping-openai', async (_req, res) => {
  try {
    // Smallest possible request via Responses API
    const r = await client.responses.create({
      model: MODEL,
      input: "Reply with the single word: pong",
    });

    // Extract the text
    const text =
      r?.output?.[0]?.content?.[0]?.text ??
      r?.output_text ??
      'no_text';

    res.json({ ok: true, model: MODEL, reply: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: err?.response?.data ?? err?.message ?? String(err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
