import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

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
  createdAt: number;
}

const POSTCARDS_KEY = "postcards_data";
const SETTINGS_KEY = "postcard_settings";
const IMAGE_DIR = Platform.OS === "web" ? "" : `${(FileSystem as any).documentDirectory}postcards/`;

async function ensureImageDir() {
  if (Platform.OS === "web") return;
  const info = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
}

export async function saveImagePermanently(uri: string): Promise<string> {
  if (Platform.OS === "web") return uri;
  await ensureImageDir();
  const id = Crypto.randomUUID();
  const ext = uri.includes(".png") ? "png" : "jpg";
  const dest = `${IMAGE_DIR}${id}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function getPostcards(): Promise<Postcard[]> {
  const data = await AsyncStorage.getItem(POSTCARDS_KEY);
  if (!data) return [];
  const postcards: Postcard[] = JSON.parse(data);
  return postcards.sort((a, b) => b.createdAt - a.createdAt);
}

export async function savePostcard(postcard: Postcard): Promise<void> {
  const postcards = await getPostcards();
  postcards.unshift(postcard);
  await AsyncStorage.setItem(POSTCARDS_KEY, JSON.stringify(postcards));
}

export async function deletePostcard(id: string): Promise<void> {
  const postcards = await getPostcards();
  const card = postcards.find((p) => p.id === id);
  if (card && Platform.OS !== "web") {
    try {
      await FileSystem.deleteAsync(card.frontImageUri, { idempotent: true });
      if (card.backImageUri) {
        await FileSystem.deleteAsync(card.backImageUri, { idempotent: true });
      }
    } catch {}
  }
  const filtered = postcards.filter((p) => p.id !== id);
  await AsyncStorage.setItem(POSTCARDS_KEY, JSON.stringify(filtered));
}

export async function getSettings(): Promise<{ targetLanguage: string }> {
  const data = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!data) return { targetLanguage: "English" };
  return JSON.parse(data);
}

export async function saveSettings(settings: { targetLanguage: string }): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function imageToBase64(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: (FileSystem as any).EncodingType.Base64,
  });
  return `data:image/jpeg;base64,${base64}`;
}
