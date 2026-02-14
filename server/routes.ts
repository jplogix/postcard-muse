import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

const PIPER_MODEL = path.resolve(process.cwd(), "server", "voices", "en_GB-alba-medium.onnx");

const ttsCache = new Map<string, { wav: Buffer; durationMs: number }>();

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

async function generatePiperTTS(text: string): Promise<{ wav: Buffer; durationMs: number }> {
  const tmpFile = path.join(os.tmpdir(), `piper_${Date.now()}.wav`);
  try {
    const { spawn } = require("node:child_process");
    const child = spawn("piper", [
      "--model", PIPER_MODEL,
      "--output_file", tmpFile,
      "--quiet",
    ]);
    child.stdin.write(text);
    child.stdin.end();
    await new Promise<void>((resolve, reject) => {
      child.on("close", (code: number) => code === 0 ? resolve() : reject(new Error(`Piper exited with code ${code}`)));
      child.on("error", reject);
    });

    const wavBuffer = fs.readFileSync(tmpFile);
    const dataSize = wavBuffer.readUInt32LE(40);
    const sampleRate = wavBuffer.readUInt32LE(24);
    const channels = wavBuffer.readUInt16LE(22);
    const bitDepth = wavBuffer.readUInt16LE(34);
    const durationMs = Math.round((dataSize / (sampleRate * channels * (bitDepth / 8))) * 1000);

    return { wav: wavBuffer, durationMs };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/tts", async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const cacheKey = hashText(text);

      if (ttsCache.has(cacheKey)) {
        const cached = ttsCache.get(cacheKey)!;
        return res.json({ audioUrl: `/api/tts-audio/${cacheKey}`, durationMs: cached.durationMs });
      }

      const result = await generatePiperTTS(text);
      ttsCache.set(cacheKey, result);

      res.json({ audioUrl: `/api/tts-audio/${cacheKey}`, durationMs: result.durationMs });
    } catch (error: any) {
      console.error("TTS error:", error?.message || error);
      res.status(500).json({ error: error.message || "TTS generation failed" });
    }
  });

  app.get("/api/tts-audio/:id", (req: Request, res: Response) => {
    const cached = ttsCache.get(req.params.id as string);
    if (!cached) {
      return res.status(404).json({ error: "Audio not found" });
    }
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(cached.wav);
  });

  app.post("/api/process-postcard", async (req: Request, res: Response) => {
    try {
      const { frontImageBase64, backImageBase64, targetLanguage } = req.body;

      if (!frontImageBase64 && !backImageBase64) {
        return res.status(400).json({ error: "At least one image is required" });
      }

      const lang = targetLanguage || "English";

      const parts: any[] = [];

      parts.push({
        text: `You are a postcard analysis expert. Analyze the provided postcard image(s) carefully.

Your task:
1. Extract ALL handwritten or printed text visible on the postcard(s). Pay close attention to handwriting.
2. Identify the language of the original text.
3. Translate the extracted text into ${lang}.
4. Provide a brief description of the postcard's visual content (the image/artwork on the front).

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
