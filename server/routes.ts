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

interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

interface TTSResult {
  durationMs: number;
  wordTimings: WordTiming[];
}

function characterAlignmentToWordTimings(
  characters: string[],
  startTimes: number[],
  endTimes: number[]
): WordTiming[] {
  const words: WordTiming[] = [];
  let currentWord = "";
  let wordStart: number | null = null;
  let wordEnd = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    if (char.trim()) {
      if (wordStart === null) {
        wordStart = startTimes[i];
      }
      currentWord += char;
      wordEnd = endTimes[i];
    } else {
      if (currentWord && wordStart !== null) {
        words.push({
          word: currentWord,
          startMs: Math.round(wordStart * 1000),
          endMs: Math.round(wordEnd * 1000),
        });
        currentWord = "";
        wordStart = null;
      }
    }
  }

  if (currentWord && wordStart !== null) {
    words.push({
      word: currentWord,
      startMs: Math.round(wordStart * 1000),
      endMs: Math.round(wordEnd * 1000),
    });
  }

  return words;
}

async function generateElevenLabsTTS(text: string, outPath: string): Promise<TTSResult> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/with-timestamps`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL,
      output_format: "mp3_44100_128",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${errText}`);
  }

  const result = await response.json() as {
    audio_base64: string;
    alignment?: {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    };
  };

  const audioBuffer = Buffer.from(result.audio_base64, "base64");
  fs.writeFileSync(outPath, audioBuffer);

  const durationMs = estimateMp3DurationMs(outPath);

  let wordTimings: WordTiming[] = [];
  if (result.alignment) {
    wordTimings = characterAlignmentToWordTimings(
      result.alignment.characters,
      result.alignment.character_start_times_seconds,
      result.alignment.character_end_times_seconds
    );
  }

  const alignPath = outPath.replace(/\.mp3$/, ".json");
  fs.writeFileSync(alignPath, JSON.stringify({ durationMs, wordTimings }));

  return { durationMs, wordTimings };
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
      const alignPath = path.join(TTS_CACHE_DIR, `${cacheKey}.json`);

      let durationMs: number;
      let wordTimings: WordTiming[] = [];

      if (fs.existsSync(mp3Path) && fs.existsSync(alignPath)) {
        const cached = JSON.parse(fs.readFileSync(alignPath, "utf-8"));
        durationMs = cached.durationMs;
        wordTimings = cached.wordTimings || [];
      } else {
        const result = await generateElevenLabsTTS(text, mp3Path);
        durationMs = result.durationMs;
        wordTimings = result.wordTimings;
      }

      if (wordTimings.length === 0 && words?.length) {
        const estimatedTimings = computeWordTimings(words, durationMs);
        let cumulative = 0;
        wordTimings = words.map((w: string, i: number) => {
          const startMs = cumulative;
          cumulative += estimatedTimings[i];
          return { word: w, startMs, endMs: cumulative };
        });
      }

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

  const BGM_PATH = path.join(TTS_CACHE_DIR, "bgm-piano.mp3");

  function generatePianoWav(): Buffer {
    const sampleRate = 44100;
    const durationSec = 24;
    const totalSamples = sampleRate * durationSec;
    const samples = new Float32Array(totalSamples);

    const noteFreqs: Record<string, number> = {
      C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
      C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
      C5: 523.25, E5: 659.25, G5: 783.99,
    };

    function pianoNote(freq: number, t: number, noteDur: number): number {
      const env = Math.exp(-t / (noteDur * 0.4)) * Math.max(0, 1 - t / noteDur);
      const fundamental = Math.sin(2 * Math.PI * freq * t) * 0.5;
      const h2 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.25 * Math.exp(-t / (noteDur * 0.25));
      const h3 = Math.sin(2 * Math.PI * freq * 3 * t) * 0.12 * Math.exp(-t / (noteDur * 0.18));
      const h4 = Math.sin(2 * Math.PI * freq * 4 * t) * 0.06 * Math.exp(-t / (noteDur * 0.12));
      return (fundamental + h2 + h3 + h4) * env;
    }

    const chords = [
      { notes: ["C4", "E4", "G4", "C5"], time: 0, dur: 3.0 },
      { notes: ["A3", "C4", "E4"], time: 2.8, dur: 3.0 },
      { notes: ["F3", "A3", "C4", "F4"], time: 5.6, dur: 3.0 },
      { notes: ["G3", "B3", "D4", "G4"], time: 8.4, dur: 3.0 },
      { notes: ["C4", "E4", "G4", "E5"], time: 11.0, dur: 3.5 },
      { notes: ["D4", "F4", "A4"], time: 14.0, dur: 2.8 },
      { notes: ["E3", "G3", "B3", "E4"], time: 16.8, dur: 3.0 },
      { notes: ["A3", "C4", "E4", "A4"], time: 19.6, dur: 3.5 },
    ];

    for (const chord of chords) {
      const startSample = Math.floor(chord.time * sampleRate);
      const chordSamples = Math.floor(chord.dur * sampleRate);
      for (const noteName of chord.notes) {
        const freq = noteFreqs[noteName];
        if (!freq) continue;
        for (let i = 0; i < chordSamples && startSample + i < totalSamples; i++) {
          const t = i / sampleRate;
          samples[startSample + i] += pianoNote(freq, t, chord.dur) * 0.15;
        }
      }
    }

    const melody = [
      { note: "E5", time: 1.0, dur: 0.8 },
      { note: "G4", time: 1.8, dur: 0.6 },
      { note: "C5", time: 3.5, dur: 1.0 },
      { note: "A4", time: 6.0, dur: 0.8 },
      { note: "G4", time: 7.0, dur: 0.7 },
      { note: "E4", time: 8.8, dur: 1.2 },
      { note: "G4", time: 11.5, dur: 0.9 },
      { note: "E5", time: 12.6, dur: 1.0 },
      { note: "D4", time: 14.5, dur: 0.8 },
      { note: "C4", time: 15.5, dur: 1.0 },
      { note: "B3", time: 17.2, dur: 0.8 },
      { note: "E4", time: 18.5, dur: 1.2 },
      { note: "C5", time: 20.2, dur: 1.5 },
    ];

    for (const m of melody) {
      const freq = noteFreqs[m.note];
      if (!freq) continue;
      const startSample = Math.floor(m.time * sampleRate);
      const noteSamples = Math.floor(m.dur * sampleRate);
      for (let i = 0; i < noteSamples && startSample + i < totalSamples; i++) {
        const t = i / sampleRate;
        samples[startSample + i] += pianoNote(freq, t, m.dur) * 0.2;
      }
    }

    const fadeIn = Math.floor(0.5 * sampleRate);
    const fadeOut = Math.floor(2.0 * sampleRate);
    for (let i = 0; i < fadeIn; i++) {
      samples[i] *= i / fadeIn;
    }
    for (let i = 0; i < fadeOut; i++) {
      const idx = totalSamples - fadeOut + i;
      if (idx >= 0) samples[idx] *= 1 - i / fadeOut;
    }

    const reverbDelay = Math.floor(0.08 * sampleRate);
    const reverbDecay = 0.3;
    for (let i = reverbDelay; i < totalSamples; i++) {
      samples[i] += samples[i - reverbDelay] * reverbDecay;
    }

    let maxAmp = 0;
    for (let i = 0; i < totalSamples; i++) {
      maxAmp = Math.max(maxAmp, Math.abs(samples[i]));
    }
    const normFactor = maxAmp > 0 ? 0.8 / maxAmp : 1;

    const int16Samples = new Int16Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      int16Samples[i] = Math.max(-32768, Math.min(32767, Math.floor(samples[i] * normFactor * 32767)));
    }

    const dataSize = int16Samples.length * 2;
    const wavBuffer = Buffer.alloc(44 + dataSize);
    wavBuffer.write("RIFF", 0);
    wavBuffer.writeUInt32LE(36 + dataSize, 4);
    wavBuffer.write("WAVE", 8);
    wavBuffer.write("fmt ", 12);
    wavBuffer.writeUInt32LE(16, 16);
    wavBuffer.writeUInt16LE(1, 20);
    wavBuffer.writeUInt16LE(1, 22);
    wavBuffer.writeUInt32LE(sampleRate, 24);
    wavBuffer.writeUInt32LE(sampleRate * 2, 28);
    wavBuffer.writeUInt16LE(2, 32);
    wavBuffer.writeUInt16LE(16, 34);
    wavBuffer.write("data", 36);
    wavBuffer.writeUInt32LE(dataSize, 40);
    for (let i = 0; i < int16Samples.length; i++) {
      wavBuffer.writeInt16LE(int16Samples[i], 44 + i * 2);
    }

    return wavBuffer;
  }

  function ensureBgmExists(): void {
    const wavPath = BGM_PATH.replace(/\.mp3$/, ".wav");
    if (fs.existsSync(wavPath)) return;

    console.log("Generating ambient piano background music...");
    const wavData = generatePianoWav();
    fs.writeFileSync(wavPath, wavData);
    console.log("Background piano music generated and cached.");
  }

  app.get("/api/bgm-piano", (_req: Request, res: Response) => {
    try {
      ensureBgmExists();
      const wavPath = BGM_PATH.replace(/\.mp3$/, ".wav");
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.sendFile(wavPath);
    } catch (error: any) {
      console.error("BGM error:", error?.message || error);
      res.status(500).json({ error: "Failed to generate background music" });
    }
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
