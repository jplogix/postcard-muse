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
import Animated from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import Colors from "@/constants/colors";
import { usePostcards } from "@/lib/PostcardContext";
import { saveImagePermanently, imageToBase64, Postcard } from "@/lib/storage";
import { apiRequest } from "@/lib/query-client";
import ScanningAnimation from "@/components/ScanningAnimation";
import ImageScanner from "@/components/ImageScanner";
import LoadingJokes from "@/components/LoadingJokes";
import MeshGradientBackground from "@/components/MeshGradientBackground";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const POSTCARD_ASPECT: [number, number] = [16, 10];

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
  const { addPostcard, targetLanguage, excludeAddress } = usePostcards();
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
        aspect: POSTCARD_ASPECT,
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
        aspect: POSTCARD_ASPECT,
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

  const processPostcard = useCallback(async () => {
    if (!backImage) {
      Alert.alert("Missing image", "Please add the text side of your postcard.");
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
        excludeAddress,
      });

      setProcessing("translating");
      const data = await response.json();

      setProcessing("saving");

      let audioPath: string | undefined;
      let audioDurationMs: number | undefined;
      const translatedText = data.translatedText || "";
      if (translatedText.length > 0) {
        try {
          const ttsResponse = await apiRequest("POST", "/api/tts", { text: translatedText });
          const ttsData = await ttsResponse.json();
          audioPath = ttsData.audioUrl;
          audioDurationMs = ttsData.durationMs;
        } catch (e) {
          console.log("TTS pre-generation skipped:", e);
        }
      }

      const frontUri = frontImage ? await saveImagePermanently(frontImage) : "";
      const backUri = backImage ? await saveImagePermanently(backImage) : null;

      const postcard: Postcard = {
        id: Crypto.randomUUID(),
        frontImageUri: frontUri || (backUri ?? ""),
        backImageUri: backUri,
        originalText: data.originalText || "",
        translatedText,
        detectedLanguage: data.detectedLanguage || "Unknown",
        targetLanguage,
        description: data.description || "",
        words: data.words || [],
        audioPath,
        audioDurationMs,
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
    const scanImage = backImage || frontImage || "";
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <MeshGradientBackground />
        <View style={styles.processingContainer}>
          {Platform.OS === "web" ? (
            <ScanningAnimation
              imageUri={scanImage}
              statusText={STATUS_MESSAGES[processing]}
            />
          ) : (
            <View style={styles.scannerWrapper}>
              <ImageScanner
                imageUrl={scanImage}
                scanSpeed={0.15}
                glowColor={[0.31, 0.27, 0.9]}
              />
              <Animated.Text style={styles.statusText}>
                {STATUS_MESSAGES[processing]}
              </Animated.Text>
            </View>
          )}
          <LoadingJokes isVisible={processing !== "done"} />
          {processing === "done" && (
            <View style={styles.doneContainer}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={28} color="#FFFFFF" />
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }

  const renderImageSlot = (
    side: "front" | "back",
    image: string | null,
    setImage: (v: string | null) => void,
    icon: string,
    iconColor: string,
    title: string,
    subtitle: string,
  ) => {
    if (image) {
      return (
        <View style={styles.imagePickerBox}>
          <Image source={{ uri: image }} style={styles.previewImage} contentFit="cover" />
          <Pressable
            onPress={() => setImage(null)}
            style={styles.removeBtn}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={24} color={Colors.light.error} />
          </Pressable>
          <View style={styles.retakeRow}>
            <Pressable
              onPress={() => takePhoto(side)}
              style={({ pressed }) => [styles.retakeChip, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={() => pickImage(side)}
              style={({ pressed }) => [styles.retakeChip, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="image" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.imagePickerBox}>
        <View style={styles.placeholderContent}>
          <View style={styles.iconCircle}>
            <Feather name={icon as any} size={22} color={iconColor} />
          </View>
          <Text style={styles.placeholderText}>{title}</Text>
          <Text style={styles.placeholderSub}>{subtitle}</Text>
          <View style={styles.inputBtns}>
            {Platform.OS !== "web" && (
              <Pressable
                onPress={() => takePhoto(side)}
                style={({ pressed }) => [pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] }]}
              >
                {isLiquidGlassAvailable() ? (
                  <GlassView style={styles.glassBtn} tintColor={Colors.light.accent}>
                    <Ionicons name="camera" size={18} color={Colors.light.accent} />
                    <Text style={styles.glassBtnText}>Camera</Text>
                  </GlassView>
                ) : (
                  <View style={styles.glassBtnFallback}>
                    <Ionicons name="camera" size={18} color={Colors.light.accent} />
                    <Text style={styles.glassBtnText}>Camera</Text>
                  </View>
                )}
              </Pressable>
            )}
            <Pressable
              onPress={() => pickImage(side)}
              style={({ pressed }) => [pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] }]}
            >
              {isLiquidGlassAvailable() ? (
                <GlassView style={styles.glassBtn} tintColor={Colors.light.accent}>
                  <Ionicons name="image" size={18} color={Colors.light.accent} />
                  <Text style={styles.glassBtnText}>Upload</Text>
                </GlassView>
              ) : (
                <View style={styles.glassBtnFallback}>
                  <Ionicons name="image" size={18} color={Colors.light.accent} />
                  <Text style={styles.glassBtnText}>Upload</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <MeshGradientBackground />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Scan Postcard</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>TEXT SIDE</Text>
        {renderImageSlot("back", backImage, setBackImage, "mail", Colors.light.accent, "Add text side image", "The side with the handwritten message")}

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>PICTURE SIDE (optional)</Text>
        {renderImageSlot("front", frontImage, setFrontImage, "image", Colors.light.indigo, "Add picture side", "The front image of the postcard")}

        {processing === "error" && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={Colors.light.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.langRow}>
          <Ionicons name="language" size={18} color={Colors.light.textSecondary} />
          <Text style={styles.langLabel}>Translating to: </Text>
          <Text style={styles.langValue}>{targetLanguage}</Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: bottomInset + 16 }]}>
        <Pressable
          onPress={processPostcard}
          disabled={!backImage}
          style={({ pressed }) => [
            styles.processBtn,
            !backImage && styles.processBtnDisabled,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Ionicons
            name="sparkles"
            size={18}
            color={backImage ? "#FFFFFF" : Colors.light.textMuted}
          />
          <Text
            style={[
              styles.processBtnText,
              !backImage && { color: Colors.light.textMuted },
            ]}
          >
            Process with AI
          </Text>
        </Pressable>
      </View>
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
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textMuted,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  imagePickerBox: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: Colors.light.glassCard,
    borderWidth: 1,
    borderColor: Colors.light.glassBorderCard,
    borderStyle: "dashed",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  placeholderContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    borderWidth: 1,
    borderColor: Colors.light.slate200,
  },
  placeholderText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  placeholderSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
    marginBottom: 4,
  },
  inputBtns: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  glassBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    overflow: "hidden",
  },
  glassBtnFallback: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(79, 70, 229, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.18)",
  },
  glassBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.accent,
  },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  retakeRow: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    gap: 6,
  },
  retakeChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.15)",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.error,
    flex: 1,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.light.glassCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.glassBorderCard,
  },
  langLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  langValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.accent,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: "rgba(250, 250, 250, 0.9)",
    borderTopWidth: 1,
    borderTopColor: Colors.light.slate200,
  },
  processBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: Colors.light.slate900,
  },
  processBtnDisabled: {
    backgroundColor: Colors.light.slate200,
  },
  processBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.light.success,
    alignItems: "center",
    justifyContent: "center",
  },
  scannerWrapper: {
    width: SCREEN_WIDTH * 0.85,
    alignItems: "center",
  },
  statusText: {
    marginTop: 20,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.accent,
    letterSpacing: 0.3,
  },
});
