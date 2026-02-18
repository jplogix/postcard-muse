import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { GoogleGenAI } from "@google/genai";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

const ELEVENLABS_VOICE_ID = "XB0fDUnXU5powFXDhCwa";
const ELEVENLABS_MODEL = "eleven_multilingual_v2";

const TTS_CACHE_DIR = path.join(os.tmpdir(), "tts-cache");

if (!fs.existsSync(TTS_CACHE_DIR)) {
  fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
}

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function estimateMp3DurationMs(filePath: string): number {
  const buf = fs.readFileSync(filePath);
  const fileSizeBytes = buf.length;
  let bitrate = 128;
  for (let i = 0; i < buf.length - 3; i++) {
    if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
      const bitrateIndex = (buf[i + 2] >> 4) & 0x0f;
      const mpegVersion = (buf[i + 1] >> 3) & 0x03;
      const layer = (buf[i + 1] >> 1) & 0x03;
      if (mpegVersion === 3 && layer === 1) {
        const bitrateTable = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
        if (bitrateIndex > 0 && bitrateIndex < 15) {
          bitrate = bitrateTable[bitrateIndex];
        }
      }
      break;
    }
  }
  return Math.round((fileSizeBytes * 8) / (bitrate * 1000) * 1000);
}

function estimateSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 2) return 1;
  let count = 0;
  const vowels = "aeiouy";
  let prevVowel = false;
  for (let i = 0; i < w.length; i++) {
    const isVowel = vowels.includes(w[i]);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  if (w.endsWith("e") && count > 1) count--;
  return Math.max(count, 1);
}

function getPunctuationPauseMs(word: string): number {
  const trimmed = word.trimEnd();
  const last = trimmed[trimmed.length - 1];
  if (".!?".includes(last)) return 500;
  if (",;:".includes(last)) return 280;
  return 0;
}

function computeWordTimings(words: string[], totalDurationMs: number): number[] {
  const syllables = words.map(estimateSyllables);
  const totalSyllables = syllables.reduce((a, b) => a + b, 0);

  const punctPauses = words.map((w, i) => i < words.length - 1 ? getPunctuationPauseMs(w) : 0);
  const totalPunctPauseMs = punctPauses.reduce((a, b) => a + b, 0);

  const gapPerWord = 20;
  const totalGapMs = gapPerWord * Math.max(words.length - 1, 0);
  const speechMs = Math.max(totalDurationMs - totalPunctPauseMs - totalGapMs, totalDurationMs * 0.5);

  return words.map((_, i) => {
    const wordDur = (syllables[i] / totalSyllables) * speechMs;
    const gap = i < words.length - 1 ? gapPerWord : 0;
    return Math.round(wordDur + punctPauses[i] + gap);
  });
}

async function generateElevenLabsTTS(text: string, outPath: string): Promise<number> {
  const audio = await elevenlabs.textToSpeech.convert(ELEVENLABS_VOICE_ID, {
    text,
    modelId: ELEVENLABS_MODEL,
    outputFormat: "mp3_44100_128",
  });

  const reader = (audio as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const buffer = Buffer.alloc(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  fs.writeFileSync(outPath, buffer);

  return estimateMp3DurationMs(outPath);
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/tts", async (req: Request, res: Response) => {
    try {
      const { text, words } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const cacheKey = hashText(text);
      const mp3Path = path.join(TTS_CACHE_DIR, `${cacheKey}.mp3`);

      let durationMs: number;
      if (fs.existsSync(mp3Path)) {
        durationMs = estimateMp3DurationMs(mp3Path);
      } else {
        durationMs = await generateElevenLabsTTS(text, mp3Path);
      }

      const wordTimings = words?.length
        ? computeWordTimings(words, durationMs)
        : undefined;

      res.json({ audioUrl: `/api/tts-audio/${cacheKey}`, durationMs, wordTimings });
    } catch (error: any) {
      console.error("TTS error:", error?.message || error);
      res.status(500).json({ error: error.message || "TTS generation failed" });
    }
  });

  app.get("/api/tts-audio/:id", (req: Request, res: Response) => {
    const mp3Path = path.join(TTS_CACHE_DIR, `${req.params.id}.mp3`);
    if (!fs.existsSync(mp3Path)) {
      return res.status(404).json({ error: "Audio not found" });
    }
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.sendFile(mp3Path);
  });

  app.post("/api/process-postcard", async (req: Request, res: Response) => {
    try {
      const { frontImageBase64, backImageBase64, targetLanguage, excludeAddress } = req.body;

      if (!frontImageBase64 && !backImageBase64) {
        return res.status(400).json({ error: "At least one image is required" });
      }

      const lang = targetLanguage || "English";

      const addressInstruction = excludeAddress
        ? "\n5. IMPORTANT: Do NOT include any mailing addresses, postal addresses, recipient names/addresses, or sender addresses in the extracted text. Only extract the personal message content, greetings, and signatures. Skip any address blocks entirely."
        : "";

      const parts: any[] = [];

      parts.push({
        text: `You are a postcard analysis expert. Analyze the provided postcard image(s) carefully.

Your task:
1. Extract ALL handwritten or printed text visible on the postcard(s). Pay close attention to handwriting.
2. Identify the language of the original text.
3. Translate the extracted text into ${lang}.
4. Provide a brief description of the postcard's visual content (the image/artwork on the front).${addressInstruction}

Respond in this exact JSON format only, no markdown wrapping:
{
  "originalText": "the extracted text exactly as written",
  "detectedLanguage": "the language detected",
  "translatedText": "the translation in ${lang}",
  "description": "brief visual description of the postcard imagery",
  "words": ["array", "of", "individual", "words", "from", "translated", "text"]
}

If no text is found on the image, set originalText and translatedText to empty strings and words to an empty array. Always provide a description.`,
      });

      if (backImageBase64) {
        const cleanBack = backImageBase64.replace(/^data:image\/\w+;base64,/, "");
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBack,
          },
        });
      }

      if (frontImageBase64) {
        const cleanFront = frontImageBase64.replace(/^data:image\/\w+;base64,/, "");
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanFront,
          },
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts }],
      });

      const text = response.text || "";
      let parsed;
      try {
        const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = {
          originalText: text,
          detectedLanguage: "Unknown",
          translatedText: text,
          description: "Could not parse AI response",
          words: text.split(/\s+/).filter(Boolean),
        };
      }

      if (!parsed.words || !Array.isArray(parsed.words)) {
        parsed.words = (parsed.translatedText || "").split(/\s+/).filter(Boolean);
      }

      res.json(parsed);
    } catch (error: any) {
      console.error("Error processing postcard:", error);
      res.status(500).json({ error: error.message || "Failed to process postcard" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
