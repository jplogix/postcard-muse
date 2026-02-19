import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolateColor,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePostcards } from "@/lib/PostcardContext";
import MeshGradientBackground from "@/components/MeshGradientBackground";

const TRACK_W = 50;
const TRACK_H = 30;
const THUMB_SIZE = 26;
const THUMB_MARGIN = 2;

function CustomToggle({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const trackStyle = useAnimatedStyle(() => {
    const bg = interpolateColor(
      withTiming(value ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad) }),
      [0, 1],
      [Colors.light.slate200, Colors.light.accent]
    );
    return { backgroundColor: bg };
  });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withTiming(
          value ? TRACK_W - THUMB_SIZE - THUMB_MARGIN * 2 : 0,
          { duration: 200, easing: Easing.out(Easing.quad) }
        ),
      },
    ],
  }));

  return (
    <Pressable onPress={() => onValueChange(!value)}>
      <Animated.View style={[styles.toggleTrack, trackStyle]}>
        <Animated.View style={[styles.toggleThumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Japanese",
  "Korean",
  "Chinese",
  "Arabic",
  "Russian",
  "Hindi",
  "Dutch",
  "Swedish",
  "Turkish",
  "Polish",
  "Vietnamese",
  "Thai",
  "Indonesian",
  "Greek",
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    targetLanguage,
    setTargetLanguage,
    excludeAddress,
    setExcludeAddress,
    backgroundMusic,
    setBackgroundMusic,
    postcards,
  } = usePostcards();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSelectLanguage = async (lang: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setTargetLanguage(lang);
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <MeshGradientBackground />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomInset + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{postcards.length}</Text>
            <Text style={styles.statLabel}>Postcards</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {new Set(postcards.map((p) => p.detectedLanguage)).size}
            </Text>
            <Text style={styles.statLabel}>Languages</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>TARGET LANGUAGE</Text>
        <Text style={styles.sectionSubtitle}>
          Postcards will be translated into this language
        </Text>

        <View style={styles.languageGrid}>
          {LANGUAGES.map((lang) => {
            const isSelected = lang === targetLanguage;
            return (
              <Pressable
                key={lang}
                onPress={() => handleSelectLanguage(lang)}
                style={({ pressed }) => [
                  styles.langChip,
                  isSelected && styles.langChipSelected,
                  pressed && { opacity: 0.8 },
                ]}
              >
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={Colors.light.accent}
                  />
                )}
                <Text
                  style={[
                    styles.langChipText,
                    isSelected && styles.langChipTextSelected,
                  ]}
                >
                  {lang}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
          PROCESSING OPTIONS
        </Text>
        <View style={styles.optionRow}>
          <View style={styles.optionInfo}>
            <Text style={styles.optionLabel}>Exclude addresses</Text>
            <Text style={styles.optionDesc}>
              Skip mailing addresses when extracting postcard text
            </Text>
          </View>
          <CustomToggle
            value={excludeAddress}
            onValueChange={(val) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setExcludeAddress(val);
            }}
          />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
          PLAYBACK
        </Text>
        <View style={styles.optionRow}>
          <View style={styles.optionInfo}>
            <Text style={styles.optionLabel}>Background music</Text>
            <Text style={styles.optionDesc}>
              Play a soft piano melody behind the spoken text
            </Text>
          </View>
          <CustomToggle
            value={backgroundMusic}
            onValueChange={(val) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setBackgroundMusic(val);
            }}
          />
        </View>

        <View style={styles.aboutSection}>
          <Text style={styles.aboutTitle}>About Postcard Muse</Text>
          <Text style={styles.aboutText}>
            A digital gallery for your physical postcards. Scan, transcribe,
            translate, and listen to handwritten messages from around the world.
          </Text>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
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
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.glassCard,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.glassBorderCard,
  },
  statValue: {
    fontSize: 28,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.accent,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginBottom: 16,
  },
  languageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 32,
  },
  langChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderWidth: 1,
    borderColor: Colors.light.slate200,
  },
  langChipSelected: {
    backgroundColor: Colors.light.accentDim,
    borderColor: "rgba(79, 70, 229, 0.3)",
  },
  langChipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  langChipTextSelected: {
    color: Colors.light.accent,
    fontFamily: "Inter_600SemiBold",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.light.glassCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.glassBorderCard,
    marginTop: 12,
    marginBottom: 28,
  },
  optionInfo: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 17,
  },
  aboutSection: {
    padding: 20,
    backgroundColor: Colors.light.glassCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.glassBorderCard,
    alignItems: "center",
  },
  aboutTitle: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
    marginBottom: 8,
  },
  aboutText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 12,
  },
  versionText: {
    fontSize: 11,
    fontFamily: "Inter_300Light",
    color: Colors.light.textMuted,
  },
  toggleTrack: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: THUMB_MARGIN,
    justifyContent: "center",
  },
  toggleThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});
