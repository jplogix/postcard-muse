import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths, Directory } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { Asset } from "expo-asset";
import { samplePostcards } from "./samplePostcards";
import { getApiUrl } from "./query-client";

export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface Postcard {
  id: string;
  frontImageUri: string;
  backImageUri: string | null;
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  targetLanguage: string;
  description: string;
  words: string[];
  audioPath?: string;
  audioDurationMs?: number;
  wordTimings?: WordTiming[];
  createdAt: number;
}

const POSTCARDS_KEY = "postcards_data";
const SETTINGS_KEY = "postcard_settings";

function getImageDir(): Directory {
  return new Directory(Paths.document, "postcards/");
}

function ensureImageDir() {
  if (Platform.OS === "web") return;
  const dir = getImageDir();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
}

export async function saveImagePermanently(uri: string): Promise<string> {
  if (Platform.OS === "web") return uri;
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  ensureImageDir();
  const id = Crypto.randomUUID();
  const ext = uri.includes(".png") ? "png" : "jpg";
  const dest = new File(getImageDir(), `${id}.${ext}`);
  const src = new File(uri);
  src.copy(dest);
  return dest.uri;
}

export async function getPostcards(): Promise<Postcard[]> {
  const data = await AsyncStorage.getItem(POSTCARDS_KEY);
  if (!data) return [];
  const raw: Postcard[] = JSON.parse(data);
  const seen = new Set<string>();
  const postcards = raw.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  if (postcards.length < raw.length) {
    await AsyncStorage.setItem(POSTCARDS_KEY, JSON.stringify(postcards));
  }
  return postcards.sort((a, b) => b.createdAt - a.createdAt);
}

export async function savePostcard(postcard: Postcard): Promise<void> {
  const postcards = await getPostcards();
  postcards.unshift(postcard);
  await AsyncStorage.setItem(POSTCARDS_KEY, JSON.stringify(postcards));
}

export async function updatePostcardData(id: string, updates: Partial<Postcard>): Promise<void> {
  const data = await AsyncStorage.getItem(POSTCARDS_KEY);
  if (!data) return;
  const postcards: Postcard[] = JSON.parse(data);
  const idx = postcards.findIndex((p) => p.id === id);
  if (idx !== -1) {
    postcards[idx] = { ...postcards[idx], ...updates };
    await AsyncStorage.setItem(POSTCARDS_KEY, JSON.stringify(postcards));
  }
}

function isLocalFileUri(uri: string): boolean {
  return uri.startsWith("file://") || uri.startsWith("/");
}

export async function deletePostcard(id: string): Promise<void> {
  const postcards = await getPostcards();
  const card = postcards.find((p) => p.id === id);
  if (card && Platform.OS !== "web") {
    try {
      if (isLocalFileUri(card.frontImageUri)) {
        const frontFile = new File(card.frontImageUri);
        if (frontFile.exists) frontFile.delete();
      }
      if (card.backImageUri && isLocalFileUri(card.backImageUri)) {
        const backFile = new File(card.backImageUri);
        if (backFile.exists) backFile.delete();
      }
    } catch {}
  }
  const filtered = postcards.filter((p) => p.id !== id);
  await AsyncStorage.setItem(POSTCARDS_KEY, JSON.stringify(filtered));
}

export interface AppSettings {
  targetLanguage: string;
  excludeAddress: boolean;
  backgroundMusic: boolean;
}

export async function getSettings(): Promise<AppSettings> {
  const data = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!data) return { targetLanguage: "English", excludeAddress: true, backgroundMusic: true };
  const parsed = JSON.parse(data);
  return { targetLanguage: parsed.targetLanguage || "English", excludeAddress: parsed.excludeAddress ?? true, backgroundMusic: parsed.backgroundMusic ?? true };
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
}

const SAMPLES_SEEDED_KEY = "samples_seeded_v5";

async function resolveAssetUri(moduleAsset: any): Promise<string> {
  if (Platform.OS === "web") {
    const asset = Asset.fromModule(moduleAsset);
    return asset.uri;
  }
  const asset = await Asset.fromModule(moduleAsset).downloadAsync();
  const localUri = asset.localUri || asset.uri;
  return await saveImagePermanently(localUri);
}

export async function seedSamplesIfNeeded(): Promise<Postcard[]> {
  const seeded = await AsyncStorage.getItem(SAMPLES_SEEDED_KEY);
  if (seeded) return [];

  const existing = await getPostcards();
  const sampleIds = new Set(samplePostcards.map((s) => s.id));
  const nonSamples = existing.filter((p) => !sampleIds.has(p.id));
  const existingIds = new Set<string>();

  const newPostcards: Postcard[] = [];

  for (const sample of samplePostcards) {
    if (existingIds.has(sample.id)) continue;
    if (!sample.originalText && !sample.translatedText) continue;

    try {
      const [frontUri, backUri] = await Promise.all([
        resolveAssetUri(sample.frontImage),
        resolveAssetUri(sample.backImage),
      ]);

      let audioUri: string | undefined;
      if (sample.audioAsset) {
        const audioAsset = await Asset.fromModule(sample.audioAsset).downloadAsync();
        audioUri = audioAsset.localUri || audioAsset.uri;
      }

      const postcard: Postcard = {
        id: sample.id,
        frontImageUri: frontUri,
        backImageUri: backUri,
        originalText: sample.originalText || "",
        translatedText: sample.translatedText || "",
        detectedLanguage: sample.detectedLanguage || "Unknown",
        targetLanguage: "English",
        description: sample.description || "",
        words: sample.words || [],
        audioPath: audioUri,
        audioDurationMs: sample.durationMs,
        wordTimings: sample.wordTimings,
        createdAt: Date.now() - newPostcards.length * 1000,
      };

      newPostcards.push(postcard);
    } catch (err) {
      console.error(`Failed to seed sample ${sample.id}:`, err);
    }
  }

  if (newPostcards.length > 0) {
    const all = [...newPostcards, ...nonSamples];
    await AsyncStorage.setItem(POSTCARDS_KEY, JSON.stringify(all));
  }

  await AsyncStorage.setItem(SAMPLES_SEEDED_KEY, "true");
  return newPostcards;
}

export async function imageToBase64(uri: string): Promise<string> {
  if (Platform.OS === "web" || uri.startsWith("http://") || uri.startsWith("https://")) {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const file = new File(uri);
  const base64 = await file.base64();
  return `data:image/jpeg;base64,${base64}`;
}
