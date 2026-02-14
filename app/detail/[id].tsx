import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Alert,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePostcards } from "@/lib/PostcardContext";
import { getApiUrl } from "@/lib/query-client";
import FlipCard, { CARD_WIDTH, CARD_HEIGHT } from "@/components/FlipCard";
import AnimatedText from "@/components/AnimatedText";
import MeshGradientBackground from "@/components/MeshGradientBackground";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { postcards, removePostcard } = usePostcards();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const postcard = postcards.find((p) => p.id === id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const cleanup = useCallback(() => {
    if (wordTimerRef.current) clearInterval(wordTimerRef.current);
    wordTimerRef.current = null;
    setIsPlaying(false);
    setCurrentWordIndex(-1);
  }, []);

  useEffect(() => {
    return () => {
      Speech.stop();
      if (wordTimerRef.current) clearInterval(wordTimerRef.current);
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const startWordTimer = useCallback((words: string[], durationMs: number) => {
    if (wordTimerRef.current) clearInterval(wordTimerRef.current);
    const intervalMs = durationMs / words.length;
    let wordIdx = 0;
    setCurrentWordIndex(0);

    wordTimerRef.current = setInterval(() => {
      wordIdx++;
      if (wordIdx >= words.length) {
        if (wordTimerRef.current) clearInterval(wordTimerRef.current);
        return;
      }
      setCurrentWordIndex(wordIdx);
    }, intervalMs);
  }, []);

  const playWithGemini = useCallback(async (): Promise<boolean> => {
    if (!postcard?.translatedText) return false;
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/tts", baseUrl);

      const response = await globalThis.fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: postcard.translatedText, voice: "Aoede" }),
      });

      if (!response.ok) return false;

      const durationMs = parseInt(response.headers.get("X-Audio-Duration-Ms") || "0", 10);
      const arrayBuffer = await response.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${base64}` },
        { shouldPlay: true }
      );
      soundRef.current = sound;

      const words = postcard.words || [];
      const audioDuration = durationMs || Math.max(postcard.translatedText.length * 65, 2000);
      startWordTimer(words, audioDuration);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          cleanup();
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });

      return true;
    } catch (err) {
      console.log("Gemini TTS unavailable, falling back to device speech");
      return false;
    }
  }, [postcard, startWordTimer, cleanup]);

  const playWithDeviceSpeech = useCallback(() => {
    if (!postcard?.translatedText || !postcard.words?.length) return;
    const words = postcard.words;
    const totalChars = postcard.translatedText.length;
    const estimatedDurationMs = Math.max(totalChars * 65, 2000);
    startWordTimer(words, estimatedDurationMs);

    Speech.speak(postcard.translatedText, {
      language: postcard.targetLanguage === "English" ? "en" : undefined,
      rate: 0.85,
      pitch: 1.0,
      onDone: cleanup,
      onError: cleanup,
    });
  }, [postcard, startWordTimer, cleanup]);

  const playAudio = useCallback(async () => {
    if (!postcard?.translatedText || !postcard.words?.length) return;

    if (isPlaying) {
      Speech.stop();
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      cleanup();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPlaying(true);
    setIsLoadingAudio(true);

    const geminiSuccess = await playWithGemini();
    setIsLoadingAudio(false);
    if (!geminiSuccess) {
      playWithDeviceSpeech();
    }
  }, [postcard, isPlaying, playWithGemini, playWithDeviceSpeech, cleanup]);

  const handleDelete = useCallback(async () => {
    if (!postcard) return;
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Delete this postcard? This cannot be undone.");
      if (!confirmed) return;
      await removePostcard(postcard.id);
      router.back();
      return;
    }
    Alert.alert("Delete Postcard", "This will permanently remove this postcard from your collection.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await removePostcard(postcard.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    ]);
  }, [postcard, removePostcard]);

  if (!postcard) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <MeshGradientBackground />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Postcard not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const date = new Date(postcard.createdAt);
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <MeshGradientBackground />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
        </Pressable>
        <Pressable onPress={handleDelete} hitSlop={12}>
          <Feather name="trash-2" size={18} color={Colors.light.error} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.flipHint}>
          <MaterialCommunityIcons name="gesture-tap" size={14} color={Colors.light.textMuted} />
          <Text style={styles.flipHintText}>Tap card to flip</Text>
        </View>

        <FlipCard
          front={
            <View style={styles.cardFace}>
              <Image
                source={{ uri: postcard.frontImageUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            </View>
          }
          back={
            <View style={[styles.cardFace, styles.cardBack]}>
              {postcard.backImageUri ? (
                <>
                  <Image
                    source={{ uri: postcard.backImageUri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                  <View style={styles.backOverlay} />
                </>
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.light.paper }]} />
              )}
              <View style={styles.backContent}>
                <View style={styles.backContentInner}>
                  {postcard.originalText ? (
                    <Text style={styles.backText} numberOfLines={8}>
                      {postcard.originalText}
                    </Text>
                  ) : (
                    <Text style={styles.noTextLabel}>No text extracted</Text>
                  )}
                </View>
              </View>
              <View style={styles.stampArea}>
                <View style={styles.stampDecor}>
                  <Ionicons name="mail" size={14} color={Colors.light.accent} />
                </View>
              </View>
            </View>
          }
        />

        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={13} color={Colors.light.textMuted} />
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>

        {postcard.description ? (
          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionLabel}>ABOUT THIS POSTCARD</Text>
            <Text style={styles.descriptionText}>{postcard.description}</Text>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <View style={styles.infoPill}>
            <Ionicons name="language" size={13} color={Colors.light.accent} />
            <Text style={styles.infoPillText}>{postcard.detectedLanguage}</Text>
          </View>
          <View style={styles.infoArrow}>
            <Feather name="arrow-right" size={13} color={Colors.light.textMuted} />
          </View>
          <View style={styles.infoPill}>
            <Ionicons name="globe" size={13} color={Colors.light.pink} />
            <Text style={styles.infoPillText}>{postcard.targetLanguage}</Text>
          </View>
        </View>

        {postcard.translatedText && postcard.words?.length > 0 ? (
          <View style={styles.translatedSection}>
            <View style={styles.translatedHeader}>
              <Text style={styles.translatedLabel}>TRANSLATED MESSAGE</Text>
              <Pressable
                onPress={playAudio}
                disabled={isLoadingAudio}
                style={({ pressed }) => [
                  styles.playBtn,
                  (isPlaying || isLoadingAudio) && styles.playBtnActive,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                ]}
              >
                {isLoadingAudio ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name={isPlaying ? "stop" : "play"}
                    size={16}
                    color={isPlaying ? "#FFFFFF" : Colors.light.accent}
                  />
                )}
              </Pressable>
            </View>
            <View style={styles.translatedTextContainer}>
              <AnimatedText
                words={postcard.words}
                currentWordIndex={currentWordIndex}
                isPlaying={isPlaying}
              />
            </View>
          </View>
        ) : null}

        {postcard.originalText && (
          <View style={styles.originalSection}>
            <Text style={styles.originalLabel}>ORIGINAL TEXT</Text>
            <Text style={styles.originalText}>{postcard.originalText}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  scrollContent: {
    paddingTop: 4,
  },
  flipHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginBottom: 12,
  },
  flipHintText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
  },
  cardFace: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  cardBack: {
    backgroundColor: Colors.light.paper,
  },
  backOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(253, 251, 247, 0.7)",
  },
  backContent: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  backContentInner: {
    backgroundColor: "rgba(255, 255, 200, 0.15)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 200, 0.3)",
  },
  backText: {
    fontSize: 18,
    fontFamily: "Caveat_400Regular",
    color: Colors.light.handwriting,
    lineHeight: 28,
  },
  noTextLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
    textAlign: "center",
    fontStyle: "italic",
  },
  stampArea: {
    position: "absolute",
    top: 12,
    right: 12,
  },
  stampDecor: {
    width: 30,
    height: 30,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.light.accent,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.5,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    marginBottom: 20,
  },
  dateText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
  },
  descriptionBox: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 16,
    backgroundColor: Colors.light.glassCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.glassBorderCard,
  },
  descriptionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textMuted,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 24,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.slate200,
  },
  infoPillText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  infoArrow: {
    opacity: 0.4,
  },
  translatedSection: {
    marginHorizontal: 24,
    marginBottom: 20,
  },
  translatedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  translatedLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textMuted,
    letterSpacing: 1.2,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.light.accentDim,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.2)",
  },
  playBtnActive: {
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.accent,
  },
  translatedTextContainer: {
    padding: 16,
    backgroundColor: Colors.light.glassCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.glassBorderCard,
    minHeight: 80,
  },
  originalSection: {
    marginHorizontal: 24,
    padding: 16,
    backgroundColor: Colors.light.glassCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.glassBorderCard,
  },
  originalLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textMuted,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  originalText: {
    fontSize: 14,
    fontFamily: "Caveat_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 22,
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
  },
  backLink: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.accent,
  },
});
