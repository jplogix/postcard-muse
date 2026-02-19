import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from "react";
import { Postcard, getPostcards, savePostcard, deletePostcard, updatePostcardData, getSettings, saveSettings } from "./storage";

interface PostcardContextValue {
  postcards: Postcard[];
  isLoading: boolean;
  targetLanguage: string;
  excludeAddress: boolean;
  backgroundMusic: boolean;
  setTargetLanguage: (lang: string) => Promise<void>;
  setExcludeAddress: (val: boolean) => Promise<void>;
  setBackgroundMusic: (val: boolean) => Promise<void>;
  addPostcard: (postcard: Postcard) => Promise<void>;
  updatePostcard: (id: string, updates: Partial<Postcard>) => Promise<void>;
  removePostcard: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const PostcardContext = createContext<PostcardContextValue | null>(null);

export function PostcardProvider({ children }: { children: ReactNode }) {
  const [postcards, setPostcards] = useState<Postcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [targetLanguage, setTargetLang] = useState("English");
  const [excludeAddress, setExcludeAddr] = useState(true);
  const [backgroundMusic, setBgMusic] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cards, settings] = await Promise.all([getPostcards(), getSettings()]);
      setPostcards(cards);
      setTargetLang(settings.targetLanguage);
      setExcludeAddr(settings.excludeAddress);
      setBgMusic(settings.backgroundMusic);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addPostcard = useCallback(async (postcard: Postcard) => {
    await savePostcard(postcard);
    setPostcards((prev) => [postcard, ...prev]);
  }, []);

  const updatePostcard = useCallback(async (id: string, updates: Partial<Postcard>) => {
    await updatePostcardData(id, updates);
    setPostcards((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const removePostcard = useCallback(async (id: string) => {
    await deletePostcard(id);
    setPostcards((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const setTargetLanguage = useCallback(async (lang: string) => {
    setTargetLang(lang);
    await saveSettings({ targetLanguage: lang });
  }, []);

  const setExcludeAddress = useCallback(async (val: boolean) => {
    setExcludeAddr(val);
    await saveSettings({ excludeAddress: val });
  }, []);

  const setBackgroundMusic = useCallback(async (val: boolean) => {
    setBgMusic(val);
    await saveSettings({ backgroundMusic: val });
  }, []);

  const value = useMemo(
    () => ({
      postcards,
      isLoading,
      targetLanguage,
      excludeAddress,
      backgroundMusic,
      setTargetLanguage,
      setExcludeAddress,
      setBackgroundMusic,
      addPostcard,
      updatePostcard,
      removePostcard,
      refresh: loadData,
    }),
    [postcards, isLoading, targetLanguage, excludeAddress, backgroundMusic, setTargetLanguage, setExcludeAddress, setBackgroundMusic, addPostcard, updatePostcard, removePostcard, loadData]
  );

  return <PostcardContext.Provider value={value}>{children}</PostcardContext.Provider>;
}

export function usePostcards() {
  const context = useContext(PostcardContext);
  if (!context) {
    throw new Error("usePostcards must be used within a PostcardProvider");
  }
  return context;
}
