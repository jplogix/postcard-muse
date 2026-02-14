import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  Platform,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import Colors from "@/constants/colors";
import { usePostcards } from "@/lib/PostcardContext";
import { saveImagePermanently, imageToBase64, Postcard } from "@/lib/storage";
import { apiRequest } from "@/lib/query-client";
import ScanningAnimation from "@/components/ScanningAnimation";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ProcessingState = "idle" | "scanning" | "extracting" | "translating" | "saving" | "done" | "error";

const STATUS_MESSAGES: Record<ProcessingState, string> = {
  idle: "",
  scanning: "Scanning postcard...",
  extracting: "Extracting handwritten text...",
  translating: "Translating message...",
  saving: "Saving to collection...",
  done: "Complete!",
  error: "Something went wrong",
};

export default function AddPostcardScreen() {
  const insets = useSafeAreaInsets();
  const { addPostcard, targetLanguage } = usePostcards();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const pickImage = useCallback(async (side: "front" | "back") => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets[0]) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (side === "front") {
          setFrontImage(result.assets[0].uri);
        } else {
          setBackImage(result.assets[0].uri);
        }
      }
    } catch (err) {
      console.error("Image picker error:", err);
    }
  }, []);

  const takePhoto = useCallback(async (side: "front" | "back") => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Camera access is required to scan postcards.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets[0]) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (side === "front") {
          setFrontImage(result.assets[0].uri);
        } else {
          setBackImage(result.assets[0].uri);
        }
      }
    } catch (err) {
      console.error("Camera error:", err);
    }
  }, []);

  const showImageOptions = useCallback((side: "front" | "back") => {
    if (Platform.OS === "web") {
      pickImage(side);
      return;
    }
    Alert.alert(
      `${side === "front" ? "Front" : "Back"} of Postcard`,
      "Choose an option",
      [
        { text: "Take Photo", onPress: () => takePhoto(side) },
        { text: "Choose from Gallery", onPress: () => pickImage(side) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }, [pickImage, takePhoto]);

  const processPostcard = useCallback(async () => {
    if (!frontImage && !backImage) {
      Alert.alert("Missing images", "Please add at least one image of your postcard.");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setProcessing("scanning");
    setErrorMsg("");

    try {
      let frontBase64: string | null = null;
      let backBase64: string | null = null;

      if (frontImage) {
        frontBase64 = await imageToBase64(frontImage);
      }
      if (backImage) {
        backBase64 = await imageToBase64(backImage);
      }

      setProcessing("extracting");

      const response = await apiRequest("POST", "/api/process-postcard", {
        frontImageBase64: frontBase64,
        backImageBase64: backBase64,
        targetLanguage,
      });

      setProcessing("translating");
      const data = await response.json();

      setProcessing("saving");

      const frontUri = frontImage ? await saveImagePermanently(frontImage) : "";
      const backUri = backImage ? await saveImagePermanently(backImage) : null;

      const postcard: Postcard = {
        id: Crypto.randomUUID(),
        frontImageUri: frontUri || (backUri ?? ""),
        backImageUri: backUri,
        originalText: data.originalText || "",
        translatedText: data.translatedText || "",
        detectedLanguage: data.detectedLanguage || "Unknown",
        targetLanguage,
        description: data.description || "",
        words: data.words || [],
        createdAt: Date.now(),
      };

      await addPostcard(postcard);
      setProcessing("done");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        router.back();
      }, 800);
    } catch (err: any) {
      console.error("Processing error:", err);
      setErrorMsg(err.message || "Failed to process postcard");
      setProcessing("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [frontImage, backImage, targetLanguage, addPostcard]);

  const isProcessing = processing !== "idle" && processing !== "error";

  if (isProcessing || processing === "done") {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <LinearGradient
          colors={[Colors.dark.background, "#0D0D1A", Colors.dark.background]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.processingContainer}>
          <ScanningAnimation
            imageUri={frontImage || backImage || ""}
            statusText={STATUS_MESSAGES[processing]}
          />
          {processing === "done" && (
            <View style={styles.doneContainer}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={32} color={Colors.dark.background} />
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <LinearGradient
        colors={[Colors.dark.background, "#12121F", Colors.dark.background]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={Colors.dark.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Scan Postcard</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>FRONT</Text>
        <Pressable
          onPress={() => showImageOptions("front")}
          style={({ pressed }) => [styles.imagePickerBox, pressed && { opacity: 0.8 }]}
        >
          {frontImage ? (
            <Image source={{ uri: frontImage }} style={styles.previewImage} contentFit="cover" />
          ) : (
            <View style={styles.placeholderContent}>
              <View style={styles.iconCircle}>
                <Feather name="image" size={24} color={Colors.dark.accent} />
              </View>
              <Text style={styles.placeholderText}>Add front image</Text>
              <Text style={styles.placeholderSub}>Tap to take a photo or choose from gallery</Text>
            </View>
          )}
          {frontImage && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                setFrontImage(null);
              }}
              style={styles.removeBtn}
            >
              <Ionicons name="close-circle" size={24} color={Colors.dark.error} />
            </Pressable>
          )}
        </Pressable>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>BACK (optional)</Text>
        <Pressable
          onPress={() => showImageOptions("back")}
          style={({ pressed }) => [styles.imagePickerBox, styles.backBox, pressed && { opacity: 0.8 }]}
        >
          {backImage ? (
            <Image source={{ uri: backImage }} style={styles.previewImage} contentFit="cover" />
          ) : (
            <View style={styles.placeholderContent}>
              <View style={styles.iconCircle}>
                <Feather name="mail" size={24} color={Colors.dark.indigo} />
              </View>
              <Text style={styles.placeholderText}>Add back image</Text>
              <Text style={styles.placeholderSub}>The side with the handwritten message</Text>
            </View>
          )}
          {backImage && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                setBackImage(null);
              }}
              style={styles.removeBtn}
            >
              <Ionicons name="close-circle" size={24} color={Colors.dark.error} />
            </Pressable>
          )}
        </Pressable>

        {processing === "error" && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={Colors.dark.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.langRow}>
          <Ionicons name="language" size={18} color={Colors.dark.textSecondary} />
          <Text style={styles.langLabel}>Translating to: </Text>
          <Text style={styles.langValue}>{targetLanguage}</Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: bottomInset + 16 }]}>
        <Pressable
          onPress={processPostcard}
          disabled={!frontImage && !backImage}
          style={({ pressed }) => [
            styles.processBtn,
            (!frontImage && !backImage) && styles.processBtnDisabled,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <LinearGradient
            colors={
              frontImage || backImage
                ? [Colors.dark.accent, "#B8862D"]
                : [Colors.dark.surfaceElevated, Colors.dark.surfaceElevated]
            }
            style={styles.processBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons
              name="sparkles"
              size={20}
              color={frontImage || backImage ? "#FFF" : Colors.dark.textMuted}
            />
            <Text
              style={[
                styles.processBtnText,
                (!frontImage && !backImage) && { color: Colors.dark.textMuted },
              ]}
            >
              Process with AI
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
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
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.dark.text,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.dark.textMuted,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  imagePickerBox: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderStyle: "dashed",
  },
  backBox: {
    height: 180,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  placeholderContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  placeholderText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.dark.textSecondary,
  },
  placeholderSub: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.2)",
  },
  errorText: {
    fontSize: 13,
    color: Colors.dark.error,
    flex: 1,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  langLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  langValue: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.dark.accent,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: "rgba(15, 15, 26, 0.95)",
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  processBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  processBtnDisabled: {
    opacity: 0.6,
  },
  processBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  processBtnText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#FFF",
  },
  processingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  doneContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.success,
    alignItems: "center",
    justifyContent: "center",
  },
});
