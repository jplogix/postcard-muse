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
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const MIN_CROP = 60;
const HANDLE_SIZE = 56;
const HANDLE_HIT = HANDLE_SIZE + 24;

interface ImageCropperProps {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onCropDone: (uri: string, width: number, height: number) => void;
  onCancel: () => void;
}

type Corner = { x: number; y: number };
type Corners = [Corner, Corner, Corner, Corner];
type DragTarget = 0 | 1 | 2 | 3 | "body" | null;
type CropMode = "crop" | "perspective";

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

  const [mode, setMode] = useState<CropMode>("crop");
  const [applying, setApplying] = useState(false);

  const [corners, setCorners] = useState<Corners>([
    { x: 0, y: 0 },
    { x: displayW, y: 0 },
    { x: displayW, y: displayH },
    { x: 0, y: displayH },
  ]);

  const cornersRef = useRef(corners);
  cornersRef.current = corners;

  const dragTarget = useRef<DragTarget>(null);
  const dragStart = useRef<{ corners: Corners; px: number; py: number }>({
    corners: [...corners] as Corners,
    px: 0,
    py: 0,
  });

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const hitTestCorner = useCallback(
    (px: number, py: number): DragTarget => {
      const c = cornersRef.current;
      for (let i = 0; i < 4; i++) {
        if (
          Math.abs(px - c[i].x) < HANDLE_HIT / 2 &&
          Math.abs(py - c[i].y) < HANDLE_HIT / 2
        ) {
          return i as 0 | 1 | 2 | 3;
        }
      }
      if (isInsideQuad(px, py, c)) return "body";
      return null;
    },
    []
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const px = e.nativeEvent.locationX;
          const py = e.nativeEvent.locationY;
          dragTarget.current = hitTestCorner(px, py);
          dragStart.current = {
            corners: cornersRef.current.map((c) => ({ ...c })) as Corners,
            px,
            py,
          };
        },
        onPanResponderMove: (
          _: GestureResponderEvent,
          g: PanResponderGestureState
        ) => {
          const target = dragTarget.current;
          if (target === null) return;

          const s = dragStart.current;
          const dx = g.dx;
          const dy = g.dy;

          if (target === "body") {
            const moved = s.corners.map((c) => ({
              x: clamp(c.x + dx, 0, displayW),
              y: clamp(c.y + dy, 0, displayH),
            })) as Corners;
            setCorners(moved);
            return;
          }

          const idx = target as number;

          if (mode === "perspective") {
            const newCorners = s.corners.map((c) => ({ ...c })) as Corners;
            newCorners[idx] = {
              x: clamp(s.corners[idx].x + dx, 0, displayW),
              y: clamp(s.corners[idx].y + dy, 0, displayH),
            };
            setCorners(newCorners);
          } else {
            const newCorners = s.corners.map((c) => ({ ...c })) as Corners;
            const nx = clamp(s.corners[idx].x + dx, 0, displayW);
            const ny = clamp(s.corners[idx].y + dy, 0, displayH);

            if (idx === 0) {
              newCorners[0] = { x: nx, y: ny };
              newCorners[1] = { x: newCorners[1].x, y: ny };
              newCorners[3] = { x: nx, y: newCorners[3].y };
            } else if (idx === 1) {
              newCorners[1] = { x: nx, y: ny };
              newCorners[0] = { x: newCorners[0].x, y: ny };
              newCorners[2] = { x: nx, y: newCorners[2].y };
            } else if (idx === 2) {
              newCorners[2] = { x: nx, y: ny };
              newCorners[1] = { x: nx, y: newCorners[1].y };
              newCorners[3] = { x: newCorners[3].x, y: ny };
            } else {
              newCorners[3] = { x: nx, y: ny };
              newCorners[0] = { x: nx, y: newCorners[0].y };
              newCorners[2] = { x: newCorners[2].x, y: ny };
            }
            setCorners(newCorners);
          }
        },
        onPanResponderRelease: () => {
          dragTarget.current = null;
        },
      }),
    [displayW, displayH, hitTestCorner, mode]
  );

  const handleConfirm = useCallback(async () => {
    setApplying(true);
    const c = cornersRef.current;

    const isPerspective =
      mode === "perspective" && !isAxisAligned(c);

    try {
      if (isPerspective) {
        const srcPoints = c.map((pt) => ({
          x: Math.round(pt.x * scale),
          y: Math.round(pt.y * scale),
        }));

        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: "base64" as any,
        });

        const apiUrl = getApiUrl();
        const url = new URL("/api/perspective-crop", apiUrl);

        const resp = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            corners: srcPoints,
            sourceWidth: imageWidth,
            sourceHeight: imageHeight,
          }),
        });

        if (!resp.ok) {
          throw new Error("Perspective crop failed");
        }

        const data = await resp.json();
        const resultBase64 = data.imageBase64;
        const resultW = data.width;
        const resultH = data.height;

        const fileUri =
          (FileSystem as any).cacheDirectory + "perspective_crop_" + Date.now() + ".jpg";
        await FileSystem.writeAsStringAsync(fileUri, resultBase64, {
          encoding: "base64" as any,
        });

        setApplying(false);
        onCropDone(fileUri, resultW, resultH);
      } else {
        const minX = Math.min(c[0].x, c[3].x);
        const maxX = Math.max(c[1].x, c[2].x);
        const minY = Math.min(c[0].y, c[1].y);
        const maxY = Math.max(c[2].y, c[3].y);

        const originX = Math.max(0, Math.round(minX * scale));
        const originY = Math.max(0, Math.round(minY * scale));
        const w = Math.min(
          Math.round((maxX - minX) * scale),
          imageWidth - originX
        );
        const h = Math.min(
          Math.round((maxY - minY) * scale),
          imageHeight - originY
        );

        const result = await manipulateAsync(
          imageUri,
          [{ crop: { originX, originY, width: Math.max(1, w), height: Math.max(1, h) } }],
          { compress: 0.85, format: SaveFormat.JPEG }
        );

        setApplying(false);
        onCropDone(result.uri, result.width, result.height);
      }
    } catch (err) {
      console.error("Crop error:", err);
      setApplying(false);
      onCropDone(imageUri, imageWidth, imageHeight);
    }
  }, [imageUri, imageWidth, imageHeight, scale, onCropDone, mode]);

  const resetCorners = useCallback(() => {
    setCorners([
      { x: 0, y: 0 },
      { x: displayW, y: 0 },
      { x: displayW, y: displayH },
      { x: 0, y: displayH },
    ]);
  }, [displayW, displayH]);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === "crop" ? "perspective" : "crop"));
  }, []);

  const quadPath = `M ${corners[0].x} ${corners[0].y} L ${corners[1].x} ${corners[1].y} L ${corners[2].x} ${corners[2].y} L ${corners[3].x} ${corners[3].y} Z`;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.modeToggle}>
          <Pressable
            onPress={() => setMode("crop")}
            style={[
              styles.modeBtn,
              mode === "crop" && styles.modeBtnActive,
            ]}
          >
            <Ionicons
              name="crop"
              size={15}
              color={mode === "crop" ? "#FFFFFF" : "#999"}
            />
            <Text
              style={[
                styles.modeBtnText,
                mode === "crop" && styles.modeBtnTextActive,
              ]}
            >
              Crop
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("perspective")}
            style={[
              styles.modeBtn,
              mode === "perspective" && styles.modeBtnActive,
            ]}
          >
            <Ionicons
              name="scan-outline"
              size={15}
              color={mode === "perspective" ? "#FFFFFF" : "#999"}
            />
            <Text
              style={[
                styles.modeBtnText,
                mode === "perspective" && styles.modeBtnTextActive,
              ]}
            >
              Perspective
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={handleConfirm} hitSlop={12} disabled={applying}>
          {applying ? (
            <ActivityIndicator size="small" color={Colors.light.accent} />
          ) : (
            <Ionicons name="checkmark" size={26} color={Colors.light.accent} />
          )}
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

        {mode === "crop" ? (
          <View style={styles.dimOverlay} pointerEvents="none">
            {renderRectDim(corners, displayW, displayH)}
          </View>
        ) : (
          <View style={styles.dimOverlay} pointerEvents="none">
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]} />
          </View>
        )}

        {mode === "crop" && (
          <View
            style={[
              styles.cropBorder,
              {
                left: Math.min(corners[0].x, corners[3].x),
                top: Math.min(corners[0].y, corners[1].y),
                width: Math.max(corners[1].x, corners[2].x) - Math.min(corners[0].x, corners[3].x),
                height: Math.max(corners[2].y, corners[3].y) - Math.min(corners[0].y, corners[1].y),
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.gridLineH1} />
            <View style={styles.gridLineH2} />
            <View style={styles.gridLineV1} />
            <View style={styles.gridLineV2} />
          </View>
        )}

        {mode === "perspective" && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {renderQuadEdges(corners)}
          </View>
        )}

        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {corners.map((c, i) => (
            <View
              key={i}
              style={[
                styles.handle,
                { left: c.x - HANDLE_SIZE / 2, top: c.y - HANDLE_SIZE / 2 },
              ]}
            >
              <View
                style={[
                  styles.handleInner,
                  mode === "perspective" && styles.handleInnerPerspective,
                ]}
              />
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: bottomInset + 16 }]}>
        <Pressable
          onPress={resetCorners}
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
          disabled={applying}
          style={({ pressed }) => [
            styles.confirmBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            applying && { opacity: 0.6 },
          ]}
        >
          {applying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.confirmText}>Apply</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function isInsideQuad(px: number, py: number, c: Corners): boolean {
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const xi = c[i].x, yi = c[i].y;
    const xj = c[j].x, yj = c[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function isAxisAligned(c: Corners): boolean {
  const eps = 3;
  return (
    Math.abs(c[0].y - c[1].y) < eps &&
    Math.abs(c[2].y - c[3].y) < eps &&
    Math.abs(c[0].x - c[3].x) < eps &&
    Math.abs(c[1].x - c[2].x) < eps
  );
}

function renderRectDim(corners: Corners, displayW: number, displayH: number) {
  const minX = Math.min(corners[0].x, corners[3].x);
  const maxX = Math.max(corners[1].x, corners[2].x);
  const minY = Math.min(corners[0].y, corners[1].y);
  const maxY = Math.max(corners[2].y, corners[3].y);

  return (
    <>
      <View style={{ width: displayW, height: Math.max(0, minY), backgroundColor: DIM_COLOR }} />
      <View style={{ flexDirection: "row", height: Math.max(0, maxY - minY) }}>
        <View style={{ width: Math.max(0, minX), height: "100%", backgroundColor: DIM_COLOR }} />
        <View style={{ width: Math.max(0, maxX - minX), height: "100%" }} />
        <View style={{ width: Math.max(0, displayW - maxX), height: "100%", backgroundColor: DIM_COLOR }} />
      </View>
      <View style={{ width: displayW, height: Math.max(0, displayH - maxY), backgroundColor: DIM_COLOR }} />
    </>
  );
}

function renderQuadEdges(corners: Corners) {
  const edges: React.ReactNode[] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const x1 = corners[i].x;
    const y1 = corners[i].y;
    const x2 = corners[j].x;
    const y2 = corners[j].y;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    edges.push(
      <View
        key={i}
        style={{
          position: "absolute",
          left: x1,
          top: y1 - 0.75,
          width: len,
          height: 1.5,
          backgroundColor: "#FFFFFF",
          transformOrigin: "0% 50%",
          transform: [{ rotate: `${angle}deg` }],
        }}
      />
    );
  }
  return edges;
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
    paddingVertical: 10,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 3,
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: Colors.light.accent,
  },
  modeBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#999",
  },
  modeBtnTextActive: {
    color: "#FFFFFF",
  },
  imageArea: {
    position: "absolute",
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 2.5,
    borderColor: Colors.light.accent,
  },
  handleInnerPerspective: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderColor: "#22D3EE",
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
