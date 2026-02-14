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
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePostcards } from "@/lib/PostcardContext";
import FlipCard, { CARD_WIDTH, CARD_HEIGHT } from "@/components/FlipCard";
import AnimatedText from "@/components/AnimatedText";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { postcards, removePostcard } = usePostcards();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const postcard = postcards.find((p) => p.id === id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      Speech.stop();
      if (wordTimerRef.current) clearInterval(wordTimerRef.current);
    };
  }, []);

  const playAudio = useCallback(() => {
    if (!postcard?.translatedText || !postcard.words?.length) return;

    if (isPlaying) {
      Speech.stop();
      setIsPlaying(false);
      setCurrentWordIndex(-1);
      if (wordTimerRef.current) clearInterval(wordTimerRef.current);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPlaying(true);
    setCurrentWordIndex(0);

    const words = postcard.words;
    const totalChars = postcard.translatedText.length;
    const estimatedDurationMs = Math.max(totalChars * 65, 2000);
    const intervalMs = estimatedDurationMs / words.length;

    let wordIdx = 0;
    wordTimerRef.current = setInterval(() => {
      wordIdx++;
      if (wordIdx >= words.length) {
        if (wordTimerRef.current) clearInterval(wordTimerRef.current);
        setTimeout(() => {
          setIsPlaying(false);
          setCurrentWordIndex(-1);
        }, 500);
        return;
      }
      setCurrentWordIndex(wordIdx);
    }, intervalMs);

    Speech.speak(postcard.translatedText, {
      language: postcard.targetLanguage === "English" ? "en" : undefined,
      rate: 0.85,
      pitch: 1.0,
      onDone: () => {
        if (wordTimerRef.current) clearInterval(wordTimerRef.current);
        setIsPlaying(false);
        setCurrentWordIndex(-1);
      },
      onError: () => {
        if (wordTimerRef.current) clearInterval(wordTimerRef.current);
        setIsPlaying(false);
        setCurrentWordIndex(-1);
      },
    });
  }, [postcard, isPlaying]);

  const handleDelete = useCallback(() => {
    if (!postcard) return;
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
      <LinearGradient
        colors={[Colors.dark.background, "#0D0D1A", Colors.dark.background]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={Colors.dark.textSecondary} />
        </Pressable>
        <Pressable onPress={handleDelete} hitSlop={12}>
          <Feather name="trash-2" size={20} color={Colors.dark.error} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.flipHint}>
          <MaterialCommunityIcons name="gesture-tap" size={16} color={Colors.dark.textMuted} />
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
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.3)"]}
                style={[StyleSheet.absoluteFillObject, { top: "60%" }]}
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
                <LinearGradient
                  colors={[Colors.dark.surface, Colors.dark.surfaceElevated]}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <View style={styles.backContent}>
                {postcard.originalText ? (
                  <Text style={styles.backText} numberOfLines={8}>
                    {postcard.originalText}
                  </Text>
                ) : (
                  <Text style={styles.noTextLabel}>No text extracted</Text>
                )}
              </View>
              <View style={styles.stampArea}>
                <View style={styles.stampDecor}>
                  <Ionicons name="mail" size={16} color={Colors.dark.accent} />
                </View>
              </View>
            </View>
          }
        />

        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={14} color={Colors.dark.textMuted} />
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
            <Ionicons name="language" size={14} color={Colors.dark.indigo} />
            <Text style={styles.infoPillText}>{postcard.detectedLanguage}</Text>
          </View>
          <View style={styles.infoArrow}>
            <Feather name="arrow-right" size={14} color={Colors.dark.textMuted} />
          </View>
          <View style={styles.infoPill}>
            <Ionicons name="globe" size={14} color={Colors.dark.accent} />
            <Text style={styles.infoPillText}>{postcard.targetLanguage}</Text>
          </View>
        </View>

        {postcard.translatedText && postcard.words?.length > 0 ? (
          <View style={styles.translatedSection}>
            <View style={styles.translatedHeader}>
              <Text style={styles.translatedLabel}>TRANSLATED MESSAGE</Text>
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
                  size={18}
                  color={isPlaying ? Colors.dark.background : Colors.dark.accent}
                />
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
    backgroundColor: Colors.dark.background,
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
    color: Colors.dark.textMuted,
  },
  cardFace: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  cardBack: {
    backgroundColor: Colors.dark.surface,
  },
  backOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backContent: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  backText: {
    fontSize: 16,
    fontFamily: "DancingScript_400Regular",
    color: Colors.dark.accentLight,
    lineHeight: 26,
  },
  noTextLabel: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: "center",
    fontStyle: "italic",
  },
  stampArea: {
    position: "absolute",
    top: 12,
    right: 12,
  },
  stampDecor: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.dark.accent,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.6,
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
    color: Colors.dark.textMuted,
  },
  descriptionBox: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 16,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  descriptionLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: Colors.dark.textMuted,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
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
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  infoPillText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.dark.textSecondary,
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
    fontWeight: "700" as const,
    color: Colors.dark.textMuted,
    letterSpacing: 1.2,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.accentDim,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212, 160, 83, 0.3)",
  },
  playBtnActive: {
    backgroundColor: Colors.dark.accent,
  },
  translatedTextContainer: {
    padding: 16,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    minHeight: 80,
  },
  originalSection: {
    marginHorizontal: 24,
    padding: 16,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  originalLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: Colors.dark.textMuted,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  originalText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 22,
    fontStyle: "italic",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.dark.textMuted,
  },
  backLink: {
    fontSize: 14,
    color: Colors.dark.accent,
    fontWeight: "600" as const,
  },
});
