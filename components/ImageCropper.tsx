import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  Text,
  GestureResponderEvent,
  PanResponderGestureState,
} from "react-native";
import { Image } from "expo-image";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const MIN_CROP = 60;
const HANDLE_SIZE = 36;
const HANDLE_HIT = HANDLE_SIZE + 16;

interface ImageCropperProps {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onCropDone: (uri: string, width: number, height: number) => void;
  onCancel: () => void;
}

type DragTarget = "tl" | "tr" | "bl" | "br" | "body" | null;

export default function ImageCropper({
  imageUri,
  imageWidth,
  imageHeight,
  onCropDone,
  onCancel,
}: ImageCropperProps) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const availableW = SCREEN_WIDTH - 32;
  const availableH = SCREEN_HEIGHT - topInset - bottomInset - 140;

  const imgRatio = imageWidth / imageHeight;
  let displayW: number, displayH: number;
  if (imgRatio > availableW / availableH) {
    displayW = availableW;
    displayH = availableW / imgRatio;
  } else {
    displayH = availableH;
    displayW = availableH * imgRatio;
  }

  const offsetX = (SCREEN_WIDTH - displayW) / 2;
  const offsetY = topInset + 60;

  const scale = imageWidth / displayW;

  const [crop, setCrop] = useState({
    x: 0,
    y: 0,
    w: displayW,
    h: displayH,
  });

  const cropRef = useRef(crop);
  cropRef.current = crop;

  const dragTarget = useRef<DragTarget>(null);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0, cw: 0, ch: 0 });

  const hitTest = useCallback(
    (px: number, py: number): DragTarget => {
      const c = cropRef.current;
      const corners: { key: DragTarget; x: number; y: number }[] = [
        { key: "tl", x: c.x, y: c.y },
        { key: "tr", x: c.x + c.w, y: c.y },
        { key: "bl", x: c.x, y: c.y + c.h },
        { key: "br", x: c.x + c.w, y: c.y + c.h },
      ];
      for (const corner of corners) {
        if (
          Math.abs(px - corner.x) < HANDLE_HIT / 2 &&
          Math.abs(py - corner.y) < HANDLE_HIT / 2
        ) {
          return corner.key;
        }
      }
      if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) {
        return "body";
      }
      return null;
    },
    []
  );

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const px = e.nativeEvent.locationX;
          const py = e.nativeEvent.locationY;
          dragTarget.current = hitTest(px, py);
          const c = cropRef.current;
          dragStart.current = { x: px, y: py, cx: c.x, cy: c.y, cw: c.w, ch: c.h };
        },
        onPanResponderMove: (_: GestureResponderEvent, g: PanResponderGestureState) => {
          const target = dragTarget.current;
          if (!target) return;

          const s = dragStart.current;
          const dx = g.dx;
          const dy = g.dy;

          let nx = s.cx;
          let ny = s.cy;
          let nw = s.cw;
          let nh = s.ch;

          if (target === "body") {
            nx = clamp(s.cx + dx, 0, displayW - s.cw);
            ny = clamp(s.cy + dy, 0, displayH - s.ch);
          } else if (target === "tl") {
            const newX = clamp(s.cx + dx, 0, s.cx + s.cw - MIN_CROP);
            const newY = clamp(s.cy + dy, 0, s.cy + s.ch - MIN_CROP);
            nw = s.cw + (s.cx - newX);
            nh = s.ch + (s.cy - newY);
            nx = newX;
            ny = newY;
          } else if (target === "tr") {
            nw = clamp(s.cw + dx, MIN_CROP, displayW - s.cx);
            const newY = clamp(s.cy + dy, 0, s.cy + s.ch - MIN_CROP);
            nh = s.ch + (s.cy - newY);
            ny = newY;
          } else if (target === "bl") {
            const newX = clamp(s.cx + dx, 0, s.cx + s.cw - MIN_CROP);
            nw = s.cw + (s.cx - newX);
            nx = newX;
            nh = clamp(s.ch + dy, MIN_CROP, displayH - s.cy);
          } else if (target === "br") {
            nw = clamp(s.cw + dx, MIN_CROP, displayW - s.cx);
            nh = clamp(s.ch + dy, MIN_CROP, displayH - s.cy);
          }

          setCrop({ x: nx, y: ny, w: nw, h: nh });
        },
        onPanResponderRelease: () => {
          dragTarget.current = null;
        },
      }),
    [displayW, displayH, hitTest]
  );

  const handleConfirm = useCallback(async () => {
    const c = cropRef.current;
    const originX = Math.round(c.x * scale);
    const originY = Math.round(c.y * scale);
    const width = Math.round(c.w * scale);
    const height = Math.round(c.h * scale);

    const safeW = Math.min(width, imageWidth - originX);
    const safeH = Math.min(height, imageHeight - originY);

    try {
      const result = await manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: Math.max(0, originX),
              originY: Math.max(0, originY),
              width: Math.max(1, safeW),
              height: Math.max(1, safeH),
            },
          },
        ],
        { compress: 0.85, format: SaveFormat.JPEG }
      );
      onCropDone(result.uri, result.width, result.height);
    } catch (err) {
      console.error("Crop error:", err);
      onCropDone(imageUri, imageWidth, imageHeight);
    }
  }, [imageUri, imageWidth, imageHeight, scale, onCropDone]);

  const renderHandle = (x: number, y: number) => (
    <View
      style={[
        styles.handle,
        {
          left: x - HANDLE_SIZE / 2,
          top: y - HANDLE_SIZE / 2,
        },
      ]}
    >
      <View style={styles.handleInner} />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Crop Image</Text>
        <Pressable onPress={handleConfirm} hitSlop={12}>
          <Ionicons name="checkmark" size={26} color={Colors.light.accent} />
        </Pressable>
      </View>

      <View
        style={[
          styles.imageArea,
          {
            width: displayW,
            height: displayH,
            left: offsetX,
            top: offsetY,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Image
          source={{ uri: imageUri }}
          style={{ width: displayW, height: displayH }}
          contentFit="cover"
        />

        <View style={styles.dimOverlay} pointerEvents="none">
          <View style={[styles.dimTop, { height: crop.y }]} />
          <View style={[styles.dimMiddle, { top: crop.y, height: crop.h }]}>
            <View style={[styles.dimSide, { width: crop.x }]} />
            <View style={{ width: crop.w, height: crop.h }} />
            <View
              style={[
                styles.dimSide,
                { width: displayW - crop.x - crop.w },
              ]}
            />
          </View>
          <View
            style={[
              styles.dimBottom,
              { height: displayH - crop.y - crop.h },
            ]}
          />
        </View>

        <View
          style={[
            styles.cropBorder,
            {
              left: crop.x,
              top: crop.y,
              width: crop.w,
              height: crop.h,
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.gridLineH1} />
          <View style={styles.gridLineH2} />
          <View style={styles.gridLineV1} />
          <View style={styles.gridLineV2} />
        </View>

        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {renderHandle(crop.x, crop.y)}
          {renderHandle(crop.x + crop.w, crop.y)}
          {renderHandle(crop.x, crop.y + crop.h)}
          {renderHandle(crop.x + crop.w, crop.y + crop.h)}
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: bottomInset + 16 }]}>
        <Pressable
          onPress={() =>
            setCrop({ x: 0, y: 0, w: displayW, h: displayH })
          }
          style={({ pressed }) => [
            styles.resetBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="refresh" size={16} color={Colors.light.accent} />
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
        <Pressable
          onPress={handleConfirm}
          style={({ pressed }) => [
            styles.confirmBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          <Text style={styles.confirmText}>Apply Crop</Text>
        </Pressable>
      </View>
    </View>
  );
}

const DIM_COLOR = "rgba(0,0,0,0.55)";

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#111111",
    zIndex: 100,
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
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  imageArea: {
    position: "absolute",
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  dimTop: {
    width: "100%",
    backgroundColor: DIM_COLOR,
  },
  dimMiddle: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
  },
  dimSide: {
    height: "100%",
    backgroundColor: DIM_COLOR,
  },
  dimBottom: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: DIM_COLOR,
  },
  cropBorder: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  gridLineH1: {
    position: "absolute",
    top: "33.33%",
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  gridLineH2: {
    position: "absolute",
    top: "66.66%",
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  gridLineV1: {
    position: "absolute",
    left: "33.33%",
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  gridLineV2: {
    position: "absolute",
    left: "66.66%",
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  handle: {
    position: "absolute",
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  handleInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: Colors.light.accent,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: "rgba(17,17,17,0.95)",
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.3)",
  },
  resetText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.accent,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.light.accent,
  },
  confirmText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});
