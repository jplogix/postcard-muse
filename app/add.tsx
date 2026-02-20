import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  Platform,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import { Asset } from "expo-asset";


import Colors from "@/constants/colors";
import { usePostcards } from "@/lib/PostcardContext";
import { saveImagePermanently, imageToBase64, Postcard } from "@/lib/storage";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import ScanningAnimation from "@/components/ScanningAnimation";
import LoadingJokes from "@/components/LoadingJokes";
import MeshGradientBackground from "@/components/MeshGradientBackground";
import ImageCropper from "@/components/ImageCropper";
import { samplePostcards, SamplePostcard } from "@/lib/samplePostcards";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
type ImageWithSize = {
  uri: string;
  width: number;
  height: number;
};

type CropPending = {
  side: "front" | "back";
  uri: string;
  width: number;
  height: number;
};

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

function SampleHint() {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);
  const bobY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(600, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(600, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
    bobY.value = withDelay(1100, withRepeat(
      withSequence(
        withTiming(-3, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(3, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true
    ));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { translateY: bobY.value }],
  }));

  return (
    <Animated.View style={[sampleHintStyles.container, animStyle]} pointerEvents="none">
      <View style={sampleHintStyles.row}>
        <Svg width={40} height={36} viewBox="0 0 40 36">
          <Path
            d="M34 4 C28 5, 18 8, 12 16 C8 22, 7 28, 8 33"
            stroke={Colors.light.accent}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            strokeDasharray="4,3"
          />
          <Path
            d="M3 28 L8 34 L13 29"
            stroke={Colors.light.accent}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={sampleHintStyles.text}>Try a sample!</Text>
      </View>
    </Animated.View>
  );
}

const sampleHintStyles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 14,
    bottom: 54,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  text: {
    fontFamily: "Caveat_500Medium",
    fontSize: 18,
    color: Colors.light.accent,
    transform: [{ rotate: "2deg" }],
    marginBottom: 19,
  },
});

export default function AddPostcardScreen() {
  const insets = useSafeAreaInsets();
  const { addPostcard, targetLanguage, excludeAddress } = usePostcards();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [frontImage, setFrontImage] = useState<ImageWithSize | null>(null);
  const [backImage, setBackImage] = useState<ImageWithSize | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [cropPending, setCropPending] = useState<CropPending | null>(null);
  const [showSamples, setShowSamples] = useState(false);
  const [selectedSample, setSelectedSample] = useState<SamplePostcard | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);

  const startCrop = useCallback((asset: ImagePicker.ImagePickerAsset, side: "front" | "back") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCropPending({
      side,
      uri: asset.uri,
      width: asset.width || 1600,
      height: asset.height || 1000,
    });
  }, []);

  const handleCropDone = useCallback((uri: string, width: number, height: number) => {
    if (!cropPending) return;
    const img: ImageWithSize = { uri, width, height };
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (cropPending.side === "front") {
      setFrontImage(img);
    } else {
      setBackImage(img);
    }
    setSelectedSample(null);
    setActiveSampleId(null);
    setCropPending(null);
  }, [cropPending]);

  const handleCropCancel = useCallback(() => {
    setCropPending(null);
  }, []);

  const pickImage = useCallback(async (side: "front" | "back") => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        startCrop(result.assets[0], side);
      }
    } catch (err) {
      console.error("Image picker error:", err);
    }
  }, [startCrop]);

  const takePhoto = useCallback(async (side: "front" | "back") => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Camera access is required to scan postcards.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        startCrop(result.assets[0], side);
      }
    } catch (err) {
      console.error("Camera error:", err);
    }
  }, [startCrop]);

  const loadSample = useCallback(async (sample: SamplePostcard) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveSampleId(sample.id);
    setSelectedSample(sample);
    setShowSamples(false);
    setLoadingSample(true);

    try {
      const [frontAsset, backAsset] = await Promise.all([
        Asset.fromModule(sample.frontImage).downloadAsync(),
        Asset.fromModule(sample.backImage).downloadAsync(),
      ]);
      const frontUri = frontAsset.localUri || frontAsset.uri;
      const backUri = backAsset.localUri || backAsset.uri;
      setFrontImage({ uri: frontUri, width: 1600, height: 1000 });
      setBackImage({ uri: backUri, width: 1600, height: 1000 });
    } catch (err) {
      console.error("Failed to load sample images:", err);
      setSelectedSample(null);
      setActiveSampleId(null);
    } finally {
      setLoadingSample(false);
    }
  }, []);

  const processSample = useCallback(async (sample: SamplePostcard) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setProcessing("scanning");
    setErrorMsg("");

    try {
      const assetPromises: Promise<Asset>[] = [
        Asset.fromModule(sample.frontImage).downloadAsync(),
        Asset.fromModule(sample.backImage).downloadAsync(),
      ];
      if (sample.audioAsset) {
        assetPromises.push(Asset.fromModule(sample.audioAsset).downloadAsync());
      }
      const assets = await Promise.all(assetPromises);
      const frontAsset = assets[0];
      const backAsset = assets[1];
      const audioAssetResult = assets[2];

      setProcessing("extracting");

      const frontUri = frontAsset.localUri || frontAsset.uri;
      const backUri = backAsset.localUri || backAsset.uri;
      const audioUri = audioAssetResult ? (audioAssetResult.localUri || audioAssetResult.uri) : undefined;

      // Longer scanning duration for samples (increased from 800ms to 2000ms)
      await new Promise((r) => setTimeout(r, 2000));
      setProcessing("translating");
      await new Promise((r) => setTimeout(r, 1500));
      setProcessing("saving");

      const savedFront = await saveImagePermanently(frontUri);
      const savedBack = await saveImagePermanently(backUri);

      const postcard: Postcard = {
        id: Crypto.randomUUID(),
        frontImageUri: savedFront,
        backImageUri: savedBack,
        originalText: sample.originalText || "",
        translatedText: sample.translatedText || "",
        detectedLanguage: sample.detectedLanguage || "Unknown",
        targetLanguage: "English",
        description: sample.description || "",
        words: sample.words || [],
        audioPath: audioUri,
        audioDurationMs: sample.durationMs,
        wordTimings: sample.wordTimings,
        createdAt: Date.now(),
      };

      await addPostcard(postcard);
      setProcessing("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        router.replace(`/detail/${postcard.id}`);
      }, 800);
    } catch (err: any) {
      console.error("Sample processing error:", err);
      setErrorMsg(err.message || "Failed to process sample postcard");
      setProcessing("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [addPostcard]);

  const processPostcard = useCallback(async () => {
    if (selectedSample) {
      processSample(selectedSample);
      return;
    }

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
        frontBase64 = await imageToBase64(frontImage.uri);
      }
      if (backImage) {
        backBase64 = await imageToBase64(backImage.uri);
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

      const frontUri = frontImage ? await saveImagePermanently(frontImage.uri) : "";
      const backUri = backImage ? await saveImagePermanently(backImage.uri) : null;

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
        router.replace(`/detail/${postcard.id}`);
      }, 800);
    } catch (err: any) {
      console.error("Processing error:", err);
      setErrorMsg(err.message || "Failed to process postcard");
      setProcessing("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [frontImage, backImage, targetLanguage, excludeAddress, addPostcard, selectedSample, processSample]);

  if (cropPending) {
    return (
      <ImageCropper
        imageUri={cropPending.uri}
        imageWidth={cropPending.width}
        imageHeight={cropPending.height}
        onCropDone={handleCropDone}
        onCancel={handleCropCancel}
      />
    );
  }

  const isProcessing = processing !== "idle" && processing !== "error";

  if (isProcessing) {
    const scanImage = backImage?.uri || frontImage?.uri || "";
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <MeshGradientBackground />
        <View style={styles.processingContainer}>
          <ScanningAnimation
            imageUri={scanImage}
            statusText={STATUS_MESSAGES[processing]}
          />
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
    image: ImageWithSize | null,
    setImage: (v: ImageWithSize | null) => void,
    icon: string,
    iconColor: string,
    title: string,
    subtitle: string,
  ) => {
    if (image) {
      const ratio = image.width / image.height;
      const clampedRatio = Math.max(0.5, Math.min(ratio, 2));
      return (
        <View style={[styles.imagePickerBox, { aspectRatio: clampedRatio }]}>
          <Image source={{ uri: image.uri }} style={styles.previewImage} contentFit="cover" />
          <Pressable
            onPress={() => { setImage(null); setSelectedSample(null); setActiveSampleId(null); }}
            style={styles.removeBtn}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={24} color={Colors.light.error} />
          </Pressable>
          <View style={styles.retakeRow}>
            <Pressable
              onPress={() => {
                setCropPending({ side, uri: image.uri, width: image.width, height: image.height });
              }}
              style={({ pressed }) => [styles.retakeChip, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="crop" size={14} color="#FFFFFF" />
            </Pressable>
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

    if (loadingSample) {
      return (
        <View style={styles.imagePickerBox}>
          <View style={styles.placeholderContent}>
            <ActivityIndicator size="small" color={Colors.light.accent} />
            <Text style={styles.placeholderSub}>Loading sample...</Text>
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
                <View style={styles.glassBtnFallback}>
                  <Ionicons name="camera" size={18} color={Colors.light.accent} />
                  <Text style={styles.glassBtnText}>Camera</Text>
                </View>
              </Pressable>
            )}
            <Pressable
              onPress={() => pickImage(side)}
              style={({ pressed }) => [pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] }]}
            >
              <View style={styles.glassBtnFallback}>
                <Ionicons name="image" size={18} color={Colors.light.accent} />
                <Text style={styles.glassBtnText}>Upload</Text>
              </View>
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
        <Pressable onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/");
          }
        }} hitSlop={12}>
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
        {showSamples && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sampleRow}
            style={styles.sampleScrollContainer}
          >
            {samplePostcards.map((sample) => (
              <Pressable
                key={sample.id}
                onPress={() => loadSample(sample)}
                style={({ pressed }) => [
                  styles.sampleCard,
                  activeSampleId === sample.id && styles.sampleCardSelected,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                ]}
              >
                <Image
                  source={sample.frontImage}
                  style={styles.sampleImage}
                  contentFit="cover"
                />
                <View style={styles.sampleInfo}>
                  <Text style={styles.sampleTitle} numberOfLines={1}>{sample.title}</Text>
                  <Text style={styles.sampleLang} numberOfLines={1}>{sample.language}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <View style={styles.bottomBtnRow}>
          {!frontImage && !backImage && !showSamples && !selectedSample && !activeSampleId && (
            <SampleHint />
          )}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowSamples(!showSamples);
            }}
            style={({ pressed }) => [
              styles.trySampleBtn,
              showSamples && styles.trySampleBtnActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Feather name="gift" size={16} color={Colors.light.accent} />
          </Pressable>
          <Pressable
            onPress={processPostcard}
            disabled={!backImage && !selectedSample}
            style={({ pressed }) => [
              styles.processBtn,
              !backImage && !selectedSample && styles.processBtnDisabled,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Ionicons
              name="sparkles"
              size={18}
              color={backImage || selectedSample ? "#FFFFFF" : Colors.light.textMuted}
            />
            <Text
              style={[
                styles.processBtnText,
                !backImage && !selectedSample && { color: Colors.light.textMuted },
              ]}
            >
              Process with AI
            </Text>
          </Pressable>
        </View>
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
  bottomBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trySampleBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(79, 70, 229, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  trySampleBtnActive: {
    backgroundColor: "rgba(79, 70, 229, 0.15)",
    borderColor: Colors.light.accent,
  },
  sampleScrollContainer: {
    marginBottom: 10,
  },
  sampleRow: {
    gap: 12,
    paddingRight: 4,
  },
  sampleCard: {
    width: 130,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.light.glassCard,
    borderWidth: 1,
    borderColor: Colors.light.glassBorderCard,
  },
  sampleCardSelected: {
    borderColor: Colors.light.accent,
    borderWidth: 2,
  },
  sampleImage: {
    width: 130,
    height: 90,
  },
  sampleInfo: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sampleTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    letterSpacing: -0.2,
  },
  sampleLang: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
    marginTop: 2,
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
    flex: 1,
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
