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
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { usePostcards } from "@/lib/PostcardContext";
import { getApiUrl } from "@/lib/query-client";
import FlipCard, { CARD_WIDTH, CARD_HEIGHT } from "@/components/FlipCard";
import AnimatedText from "@/components/AnimatedText";
import MeshGradientBackground from "@/components/MeshGradientBackground";
import ScanningAnimation from "@/components/ScanningAnimation";
import LoadingJokes from "@/components/LoadingJokes";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function resolveUri(uri: string | null): string {
  if (!uri) return "";
  if (uri.startsWith("file://") || uri.startsWith("http://") || uri.startsWith("https://") || uri.startsWith("data:")) return uri;
  if (uri.startsWith("/") || uri.startsWith("asset")) return uri;
  try {
    return new URL(uri, getApiUrl()).href;
  } catch {
    return uri;
  }
}

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { postcards, removePostcard, backgroundMusic } = usePostcards();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const postcard = postcards.find((p) => p.id === id);
  const isSample = id?.startsWith("sample-") ?? false;
  const [showScanAnim, setShowScanAnim] = useState(false);
  const [scanPhase, setScanPhase] = useState<"scanning" | "extracting" | "translating" | "done">("scanning");
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!isSample || !id) return;
    const key = `sample_scanned_${id}`;
    AsyncStorage.getItem(key).then((val) => {
      if (!val) {
        setShowScanAnim(true);
        setScanPhase("scanning");
        AsyncStorage.setItem(key, "1");
        setTimeout(() => setScanPhase("extracting"), 2500);
        setTimeout(() => setScanPhase("translating"), 4500);
        setTimeout(() => {
          setScanPhase("done");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => setShowScanAnim(false), 1000);
        }, 6500);
      }
    });
  }, [isSample, id]);
  const syncFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const seekingRef = useRef(false);

  const baseUrl = getApiUrl();
  const initialAudioUrl = postcard?.audioPath
    ? (postcard.audioPath.startsWith("file://") || postcard.audioPath.startsWith("http"))
      ? postcard.audioPath
      : new URL(postcard.audioPath, baseUrl).toString()
    : null;
  const [audioSource, setAudioSource] = useState<string | null>(initialAudioUrl);
  const [audioDurationMs, setAudioDurationMs] = useState(postcard?.audioDurationMs || 0);
  const wordTimingsRef = useRef<{ word: string; startMs: number; endMs: number }[] | null>(postcard?.wordTimings || null);
  const replayOverlayOpacity = useSharedValue(0);
  const replayOverlayStyle = useAnimatedStyle(() => ({
    opacity: replayOverlayOpacity.value,
  }));

  const bgmUrl = backgroundMusic
    ? new URL("/api/bgm-piano", baseUrl).toString()
    : null;

  const player = useAudioPlayer(audioSource);
  const status = useAudioPlayerStatus(player);

  const bgmPlayer = useAudioPlayer(bgmUrl);

  useEffect(() => {
    if (bgmPlayer) {
      bgmPlayer.volume = 0.12;
      bgmPlayer.loop = true;
    }
  }, [bgmPlayer]);

  const stopSync = useCallback(() => {
    if (syncFrameRef.current) {
      cancelAnimationFrame(syncFrameRef.current);
      syncFrameRef.current = null;
    }
  }, []);

  const bgmFadeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const finishPlayback = useCallback(() => {
    stopSync();
    setIsPlaying(false);
    setHasPlayed(true);
    const wordCount = postcard?.words?.length || 0;
    if (wordCount > 0) setCurrentWordIndex(wordCount - 1);

    if (backgroundMusic && bgmPlayer && bgmPlayer.playing) {
      const fadeDuration = 3000;
      const steps = 30;
      const stepMs = fadeDuration / steps;
      const startVol = bgmPlayer.volume || 0.12;
      let step = 0;
      if (bgmFadeRef.current) clearInterval(bgmFadeRef.current);
      bgmFadeRef.current = setInterval(() => {
        step++;
        const progress = step / steps;
        try { bgmPlayer.volume = startVol * (1 - progress); } catch {}
        if (step >= steps) {
          if (bgmFadeRef.current) clearInterval(bgmFadeRef.current);
          bgmFadeRef.current = null;
          try { bgmPlayer.pause(); bgmPlayer.volume = 0.12; } catch {}
        }
      }, stepMs);
      setTimeout(() => {
        replayOverlayOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) });
      }, fadeDuration);
    } else {
      try { bgmPlayer.pause(); } catch {}
      replayOverlayOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) });
    }
  }, [stopSync, postcard, replayOverlayOpacity, bgmPlayer, backgroundMusic]);

  const resetPlayback = useCallback(() => {
    stopSync();
    if (bgmFadeRef.current) { clearInterval(bgmFadeRef.current); bgmFadeRef.current = null; }
    seekingRef.current = false;
    setIsPlaying(false);
    setHasPlayed(false);
    setCurrentWordIndex(-1);
    replayOverlayOpacity.value = withTiming(0, { duration: 250 });
    try { bgmPlayer.pause(); bgmPlayer.volume = 0.12; } catch {}
  }, [stopSync, replayOverlayOpacity, bgmPlayer]);

  useEffect(() => {
    return () => {
      stopSync();
      if (bgmFadeRef.current) { clearInterval(bgmFadeRef.current); bgmFadeRef.current = null; }
      try { bgmPlayer.pause(); } catch {}
    };
  }, [stopSync, bgmPlayer]);

  useEffect(() => {
    if (isPlaying && status.playing && seekingRef.current) {
      seekingRef.current = false;
    }
    if (!isPlaying || !status.playing) return;
    const words = postcard?.words || [];
    if (words.length === 0) return;
    const duration = audioDurationMs || Math.max((postcard?.translatedText?.length || 20) * 65, 2000);
    const timings = wordTimingsRef.current;

    const syncLoop = () => {
      const currentMs = (player as any).currentTime * 1000;

      let wordIdx: number;
      if (timings && timings.length > 0) {
        wordIdx = 0;
        for (let i = 0; i < timings.length; i++) {
          if (currentMs >= timings[i].startMs) {
            wordIdx = i;
          }
        }
      } else {
        const progress = Math.min(currentMs / duration, 1);
        wordIdx = Math.min(Math.floor(progress * words.length), words.length - 1);
      }

      setCurrentWordIndex(wordIdx);

      if (currentMs < duration) {
        syncFrameRef.current = requestAnimationFrame(syncLoop);
      }
    };
    syncFrameRef.current = requestAnimationFrame(syncLoop);

    return () => stopSync();
  }, [status.playing, isPlaying, audioDurationMs, postcard, player, stopSync]);

  useEffect(() => {
    if (isPlaying && status.playing && backgroundMusic && bgmPlayer) {
      try {
        const bgmStatus = bgmPlayer.playing;
        if (!bgmStatus) {
          bgmPlayer.play();
        }
      } catch {}
    }
  }, [isPlaying, status.playing, backgroundMusic, bgmPlayer]);

  useEffect(() => {
    if (isPlaying && !status.playing && status.currentTime > 0 && !seekingRef.current) {
      finishPlayback();
    }
  }, [status.playing, status.currentTime, isPlaying, finishPlayback]);

  const { updatePostcard } = usePostcards();

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    player.volume = newMuted ? 0 : 1;
    if (bgmPlayer) {
      bgmPlayer.volume = newMuted ? 0 : 0.12;
    }
  }, [isMuted, player, bgmPlayer]);

  const playAudio = useCallback(async () => {
    if (!postcard?.translatedText || !postcard.words?.length) return;

    if (isPlaying) {
      player.pause();
      finishPlayback();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    replayOverlayOpacity.value = withTiming(0, { duration: 200 });
    setHasPlayed(false);
    setCurrentWordIndex(-1);
    setIsMuted(false);
    player.volume = 1;
    setIsPlaying(true);

    if (audioSource && wordTimingsRef.current && wordTimingsRef.current.length > 0) {
      try {
        seekingRef.current = true;
        player.seekTo(0);
        setTimeout(() => {
          seekingRef.current = false;
          player.play();
          if (backgroundMusic && bgmPlayer) {
            bgmPlayer.seekTo(0);
            bgmPlayer.play();
          }
        }, 150);
      } catch (e) {
        console.log("Replay seek error:", e);
        seekingRef.current = false;
        player.play();
        if (backgroundMusic && bgmPlayer) {
          bgmPlayer.seekTo(0);
          bgmPlayer.play();
        }
      }
      return;
    }

    try {
      const url = new URL("/api/tts", baseUrl);
      const response = await globalThis.fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: postcard.translatedText, words: postcard.words }),
      });

      if (!response.ok) throw new Error("TTS request failed");

      const data = await response.json();
      const fullAudioUrl = new URL(data.audioUrl, baseUrl).toString();
      setAudioDurationMs(data.durationMs);
      if (data.wordTimings) {
        wordTimingsRef.current = data.wordTimings;
      }

      if (audioSource) {
        player.seekTo(0);
        setTimeout(() => {
          player.play();
          if (backgroundMusic && bgmPlayer) {
            bgmPlayer.seekTo(0);
            bgmPlayer.play();
          }
        }, 100);
      } else {
        setAudioSource(fullAudioUrl);
      }

      if (updatePostcard) {
        updatePostcard(postcard.id, {
          audioPath: data.audioUrl,
          audioDurationMs: data.durationMs,
        });
      }
    } catch (err) {
      console.error("TTS error:", err);
      resetPlayback();
    }
  }, [postcard, isPlaying, player, finishPlayback, resetPlayback, audioSource, baseUrl, updatePostcard, backgroundMusic, bgmPlayer]);

  const handleDelete = useCallback(async () => {
    if (!postcard) return;
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Delete this postcard? This cannot be undone.");
      if (!confirmed) return;
      await removePostcard(postcard.id);
      if (router.canGoBack()) router.back(); else router.replace("/");
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
          if (router.canGoBack()) router.back(); else router.replace("/");
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
          <Pressable onPress={() => router.replace("/")}>
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

  const scanStatusText = scanPhase === "scanning"
    ? "Scanning postcard..."
    : scanPhase === "extracting"
    ? "Extracting handwritten text..."
    : scanPhase === "translating"
    ? "Translating message..."
    : "Complete!";

  if (showScanAnim) {
    const scanImage = resolveUri(postcard.backImageUri || postcard.frontImageUri);
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <MeshGradientBackground />
        <View style={styles.scanOverlay}>
          <ScanningAnimation imageUri={scanImage} statusText={scanStatusText} />
          <LoadingJokes isVisible={scanPhase !== "done"} />
          {scanPhase === "done" && (
            <View style={styles.scanDoneContainer}>
              <View style={styles.scanCheckCircle}>
                <Ionicons name="checkmark" size={28} color="#FFFFFF" />
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <MeshGradientBackground />

      <View style={styles.header}>
        <Pressable onPress={() => {
          if (router.canGoBack()) router.back(); else router.replace("/");
        }} hitSlop={12}>
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
                source={{ uri: resolveUri(postcard.frontImageUri) }}
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
                    source={{ uri: resolveUri(postcard.backImageUri) }}
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
              {!hasPlayed || isPlaying ? (
                <Pressable
                  onPress={playAudio}
                  style={({ pressed }) => [
                    styles.playBtn,
                    isPlaying && styles.playBtnActive,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                  ]}
                >
                  <Ionicons
                    name={isPlaying ? "stop" : "play"}
                    size={16}
                    color={isPlaying ? "#FFFFFF" : Colors.light.accent}
                  />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.translatedTextContainer}>
              {isPlaying && (
                <Pressable
                  onPress={toggleMute}
                  style={({ pressed }) => [
                    styles.muteBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  hitSlop={8}
                >
                  <Ionicons
                    name={isMuted ? "volume-mute" : "volume-high"}
                    size={16}
                    color={Colors.light.textMuted}
                  />
                </Pressable>
              )}
              {!isPlaying && !hasPlayed ? (
                <Pressable onPress={playAudio} style={styles.playHintContainer}>
                  <Feather name="arrow-up" size={16} color={Colors.light.accent} style={{ marginBottom: -2 }} />
                  <View style={styles.playHintPill}>
                    <Ionicons name="play" size={14} color={Colors.light.accent} />
                    <Text style={styles.playHintText}>Tap play to hear the translation</Text>
                  </View>
                </Pressable>
              ) : (
                <AnimatedText
                  words={postcard.words}
                  currentWordIndex={currentWordIndex}
                  isPlaying={isPlaying}
                  hasPlayed={hasPlayed}
                  wordTimings={wordTimingsRef.current}
                />
              )}
              <Animated.View
                style={[styles.replayOverlay, replayOverlayStyle]}
                pointerEvents={hasPlayed && !isPlaying ? "auto" : "none"}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.7)", "rgba(255,255,255,0.95)"]}
                  locations={[0, 0.4, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <Pressable
                  onPress={playAudio}
                  style={({ pressed }) => [
                    styles.replayOverlayBtn,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                  ]}
                >
                  <Ionicons name="refresh" size={20} color="#FFFFFF" />
                  <Text style={styles.replayOverlayText}>Replay</Text>
                </Pressable>
              </Animated.View>
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
  scanOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanDoneContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  scanCheckCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.light.accent,
    justifyContent: "center",
    alignItems: "center",
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
  replayOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 18,
  },
  replayOverlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  replayOverlayText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
    letterSpacing: 0.3,
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
  muteBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.light.slate200,
  },
  translatedTextContainer: {
    padding: 16,
    backgroundColor: Colors.light.glassCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.glassBorderCard,
    minHeight: 80,
    overflow: "hidden",
  },
  playHintContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 2,
  },
  playHintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.accentDim,
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.15)",
  },
  playHintText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.accent,
    letterSpacing: 0.2,
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
