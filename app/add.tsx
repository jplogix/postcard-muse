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
import MeshGradientBackground from "@/components/MeshGradientBackground";

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
        <MeshGradientBackground />
        <View style={styles.processingContainer}>
          <ScanningAnimation
            imageUri={backImage || frontImage || ""}
            statusText={STATUS_MESSAGES[processing]}
          />
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
        <Pressable
          onPress={() => showImageOptions("back")}
          style={({ pressed }) => [styles.imagePickerBox, pressed && { opacity: 0.85 }]}
        >
          {backImage ? (
            <Image source={{ uri: backImage }} style={styles.previewImage} contentFit="cover" />
          ) : (
            <View style={styles.placeholderContent}>
              <View style={styles.iconCircle}>
                <Feather name="mail" size={22} color={Colors.light.accent} />
              </View>
              <Text style={styles.placeholderText}>Add text side image</Text>
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
              <Ionicons name="close-circle" size={24} color={Colors.light.error} />
            </Pressable>
          )}
        </Pressable>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>PICTURE SIDE (optional)</Text>
        <Pressable
          onPress={() => showImageOptions("front")}
          style={({ pressed }) => [styles.imagePickerBox, styles.backBox, pressed && { opacity: 0.85 }]}
        >
          {frontImage ? (
            <Image source={{ uri: frontImage }} style={styles.previewImage} contentFit="cover" />
          ) : (
            <View style={styles.placeholderContent}>
              <View style={styles.iconCircle}>
                <Feather name="image" size={22} color={Colors.light.indigo} />
              </View>
              <Text style={styles.placeholderText}>Add picture side</Text>
              <Text style={styles.placeholderSub}>The front image of the postcard</Text>
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
              <Ionicons name="close-circle" size={24} color={Colors.light.error} />
            </Pressable>
          )}
        </Pressable>

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
  backBox: {},
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
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
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
});
