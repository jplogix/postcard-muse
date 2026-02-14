import React from "react";
import { View, StyleSheet, Pressable, Text, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { Postcard } from "@/lib/storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GAP = 12;
const CARD_SIZE = (SCREEN_WIDTH - 48 - GAP) / 2;

interface PostcardThumbnailProps {
  postcard: Postcard;
  onPress: () => void;
}

export default function PostcardThumbnail({ postcard, onPress }: PostcardThumbnailProps) {
  const date = new Date(postcard.createdAt);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
    >
      <Image source={{ uri: postcard.frontImageUri }} style={styles.image} contentFit="cover" transition={200} />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.7)"]}
        style={styles.gradient}
      />
      <View style={styles.overlay}>
        <View style={styles.langBadge}>
          <Ionicons name="language" size={10} color={Colors.dark.accent} />
          <Text style={styles.langText}>{postcard.detectedLanguage}</Text>
        </View>
        <Text style={styles.date} numberOfLines={1}>{dateStr}</Text>
      </View>
      {!!postcard.translatedText && (
        <View style={styles.hasTextBadge}>
          <Ionicons name="document-text" size={10} color={Colors.dark.text} />
        </View>
      )}
    </Pressable>
  );
}

export { CARD_SIZE, GAP };

const styles = StyleSheet.create({
  container: {
    width: CARD_SIZE,
    height: CARD_SIZE * 0.75,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    top: "50%",
  },
  overlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  langBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  langText: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontWeight: "500" as const,
  },
  date: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    fontWeight: "500" as const,
  },
  hasTextBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(212, 160, 83, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
});
