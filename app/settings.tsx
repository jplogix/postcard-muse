import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePostcards } from "@/lib/PostcardContext";

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
  const { targetLanguage, setTargetLanguage, postcards } = usePostcards();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSelectLanguage = async (lang: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setTargetLanguage(lang);
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <LinearGradient
        colors={[Colors.dark.background, "#12121F", Colors.dark.background]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={Colors.dark.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 32 }]}
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
                  <Ionicons name="checkmark-circle" size={14} color={Colors.dark.accent} />
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

        <View style={styles.aboutSection}>
          <Text style={styles.aboutTitle}>About Postcard Muse</Text>
          <Text style={styles.aboutText}>
            A digital gallery for your physical postcards. Scan, transcribe, translate, and listen
            to handwritten messages from around the world.
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
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.dark.text,
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
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statValue: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.dark.accent,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 4,
    fontWeight: "500" as const,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.dark.textMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
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
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  langChipSelected: {
    backgroundColor: Colors.dark.accentDim,
    borderColor: "rgba(212, 160, 83, 0.4)",
  },
  langChipText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontWeight: "500" as const,
  },
  langChipTextSelected: {
    color: Colors.dark.accent,
    fontWeight: "700" as const,
  },
  aboutSection: {
    padding: 20,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: "center",
  },
  aboutTitle: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.dark.text,
    marginBottom: 8,
  },
  aboutText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 12,
  },
  versionText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
});
