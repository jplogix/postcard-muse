import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

const directAi = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

function createWavBuffer(pcmData: Buffer, sampleRate = 24000, channels = 1, bitDepth = 16): Buffer {
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmData.length, 40);
  return Buffer.concat([header, pcmData]);
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/tts", async (req: Request, res: Response) => {
    try {
      const { text, voice } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const ttsClient = directAi || ai;
      const voiceName = voice || "Aoede";

      const response = await ttsClient.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Read this text naturally and warmly: ${text}` }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        } as any,
      });

      const candidate = response.candidates?.[0];
      const part = candidate?.content?.parts?.[0];
      const audioData = (part as any)?.inlineData?.data;

      if (!audioData) {
        return res.status(500).json({ error: "No audio generated" });
      }

      const pcmBuffer = Buffer.from(audioData, "base64");
      const wavBuffer = createWavBuffer(pcmBuffer);

      const durationMs = Math.round((pcmBuffer.length / (24000 * 2)) * 1000);

      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("X-Audio-Duration-Ms", durationMs.toString());
      res.send(wavBuffer);
    } catch (error: any) {
      console.error("TTS error:", error?.message || error);
      res.status(500).json({ error: error.message || "TTS generation failed" });
    }
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
