import React from "react";
import { View, StyleSheet, Pressable, Text, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { Postcard } from "@/lib/storage";
import { getApiUrl } from "@/lib/query-client";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GAP = 12;
const CARD_SIZE = (SCREEN_WIDTH - 40 - GAP) / 2;

interface PostcardThumbnailProps {
  postcard: Postcard;
  onPress: () => void;
}

function resolveUri(uri: string): string {
  if (uri.startsWith("file://") || uri.startsWith("http://") || uri.startsWith("https://") || uri.startsWith("data:")) return uri;
  if (uri.startsWith("/") || uri.startsWith("asset")) return uri;
  try {
    return new URL(uri, getApiUrl()).href;
  } catch {
    return uri;
  }
}

export default function PostcardThumbnail({ postcard, onPress }: PostcardThumbnailProps) {
  const date = new Date(postcard.createdAt);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const imageUri = resolveUri(postcard.frontImageUri);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
    >
      <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" transition={200} />
      <View style={styles.overlay}>
        <View style={styles.langBadge}>
          <Ionicons name="language" size={10} color={Colors.light.accent} />
          <Text style={styles.langText}>{postcard.detectedLanguage}</Text>
        </View>
        <Text style={styles.date} numberOfLines={1}>{dateStr}</Text>
      </View>
      {!!postcard.translatedText && (
        <View style={styles.hasTextBadge}>
          <Ionicons name="document-text" size={10} color="#FFFFFF" />
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
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.slate200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: "100%",
    height: "100%",
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
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  langText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.light.slate700,
  },
  date: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255, 255, 255, 0.9)",
  },
  hasTextBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.light.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
