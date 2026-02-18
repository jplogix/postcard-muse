import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { GoogleGenAI } from "@google/genai";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import sharp from "sharp";

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

function computeHomography(
  src: [number, number][],
  dst: [number, number][]
): number[] {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [sx, sy] = src[i];
    const [dx, dy] = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy, dx]);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy, dy]);
  }

  const n = 9;
  const m = 8;
  const M = A.map((row) => [...row]);

  for (let col = 0; col < m; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < m; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let j = col; j < n; j++) M[col][j] /= pivot;

    for (let row = 0; row < m; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = col; j < n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  const h = new Array(9);
  h[8] = 1;
  for (let i = 7; i >= 0; i--) {
    h[i] = M[i][8];
    for (let j = i + 1; j < 8; j++) {
      h[i] -= M[i][j] * h[j];
    }
  }

  return h;
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

  app.post("/api/perspective-crop", async (req: Request, res: Response) => {
    try {
      const { imageBase64, corners, sourceWidth, sourceHeight } = req.body;
      if (!imageBase64 || !corners || corners.length !== 4) {
        return res.status(400).json({ error: "Image and 4 corners required" });
      }

      const imgBuf = Buffer.from(imageBase64, "base64");
      const meta = await sharp(imgBuf).metadata();
      const w = meta.width || sourceWidth;
      const h = meta.height || sourceHeight;

      const tl = corners[0];
      const tr = corners[1];
      const br = corners[2];
      const bl = corners[3];

      const topEdge = Math.sqrt((tr.x - tl.x) ** 2 + (tr.y - tl.y) ** 2);
      const bottomEdge = Math.sqrt((br.x - bl.x) ** 2 + (br.y - bl.y) ** 2);
      const leftEdge = Math.sqrt((bl.x - tl.x) ** 2 + (bl.y - tl.y) ** 2);
      const rightEdge = Math.sqrt((br.x - tr.x) ** 2 + (br.y - tr.y) ** 2);

      const outW = Math.round(Math.max(topEdge, bottomEdge));
      const outH = Math.round(Math.max(leftEdge, rightEdge));

      const srcCorners: [number, number][] = [
        [tl.x, tl.y],
        [tr.x, tr.y],
        [br.x, br.y],
        [bl.x, bl.y],
      ];
      const dstCorners: [number, number][] = [
        [0, 0],
        [outW, 0],
        [outW, outH],
        [0, outH],
      ];

      const Hinv = computeHomography(dstCorners, srcCorners);

      const { data: rawPixels, info } = await sharp(imgBuf)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const srcW = info.width;
      const srcH = info.height;
      const channels = info.channels;

      const outBuf = Buffer.alloc(outW * outH * channels);

      for (let oy = 0; oy < outH; oy++) {
        for (let ox = 0; ox < outW; ox++) {
          const denom = Hinv[6] * ox + Hinv[7] * oy + Hinv[8];
          const sx = (Hinv[0] * ox + Hinv[1] * oy + Hinv[2]) / denom;
          const sy = (Hinv[3] * ox + Hinv[4] * oy + Hinv[5]) / denom;

          const x0 = Math.floor(sx);
          const y0 = Math.floor(sy);
          const x1 = x0 + 1;
          const y1 = y0 + 1;
          const fx = sx - x0;
          const fy = sy - y0;

          if (x0 >= 0 && x1 < srcW && y0 >= 0 && y1 < srcH) {
            const outIdx = (oy * outW + ox) * channels;
            for (let c = 0; c < channels; c++) {
              const v00 = rawPixels[(y0 * srcW + x0) * channels + c];
              const v10 = rawPixels[(y0 * srcW + x1) * channels + c];
              const v01 = rawPixels[(y1 * srcW + x0) * channels + c];
              const v11 = rawPixels[(y1 * srcW + x1) * channels + c];
              const top = v00 + (v10 - v00) * fx;
              const bot = v01 + (v11 - v01) * fx;
              outBuf[outIdx + c] = Math.round(top + (bot - top) * fy);
            }
          }
        }
      }

      const resultBuf = await sharp(outBuf, {
        raw: { width: outW, height: outH, channels },
      })
        .jpeg({ quality: 85 })
        .toBuffer();

      const resultBase64 = resultBuf.toString("base64");
      res.json({ imageBase64: resultBase64, width: outW, height: outH });
    } catch (error: any) {
      console.error("Perspective crop error:", error);
      res.status(500).json({ error: error.message || "Perspective crop failed" });
    }
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
