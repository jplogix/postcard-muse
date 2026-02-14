import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from "react";
import { Postcard, getPostcards, savePostcard, deletePostcard, getSettings, saveSettings } from "./storage";

interface PostcardContextValue {
  postcards: Postcard[];
  isLoading: boolean;
  targetLanguage: string;
  setTargetLanguage: (lang: string) => Promise<void>;
  addPostcard: (postcard: Postcard) => Promise<void>;
  removePostcard: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const PostcardContext = createContext<PostcardContextValue | null>(null);

export function PostcardProvider({ children }: { children: ReactNode }) {
  const [postcards, setPostcards] = useState<Postcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [targetLanguage, setTargetLang] = useState("English");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cards, settings] = await Promise.all([getPostcards(), getSettings()]);
      setPostcards(cards);
      setTargetLang(settings.targetLanguage);
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

  const removePostcard = useCallback(async (id: string) => {
    await deletePostcard(id);
    setPostcards((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const setTargetLanguage = useCallback(async (lang: string) => {
    setTargetLang(lang);
    await saveSettings({ targetLanguage: lang });
  }, []);

  const value = useMemo(
    () => ({
      postcards,
      isLoading,
      targetLanguage,
      setTargetLanguage,
      addPostcard,
      removePostcard,
      refresh: loadData,
    }),
    [postcards, isLoading, targetLanguage, setTargetLanguage, addPostcard, removePostcard, loadData]
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
