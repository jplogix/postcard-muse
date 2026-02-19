import React, { useEffect, useRef, useMemo, useCallback } from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
  cancelAnimation,
  useDerivedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";

const isWeb = Platform.OS === "web";
const noiseTexture = require("@/assets/images/noise.png");

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.75;
const CARD_HEIGHT = CARD_WIDTH * 0.65;
const NUM_DETECTION_BOXES = 8;
const BASE_SCALE = 1.2;
const ZOOM_SCALE = 1.8;
const ZOOM_PAN_X = CARD_WIDTH * 0.25;
const ZOOM_PAN_Y = CARD_HEIGHT * 0.25;
const BEAM_HEIGHT = CARD_HEIGHT * 0.35;
const SCAN_DURATION = 2400;

const SCANLINE_COUNT = Math.floor(CARD_HEIGHT / 3);

const CYAN = "#22D3EE";
const CYAN_30 = "rgba(34, 211, 238, 0.3)";
const CYAN_50 = "rgba(34, 211, 238, 0.5)";

interface DetectionBoxConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

function generateDetectionBoxes(count: number): DetectionBoxConfig[] {
  const boxes: DetectionBoxConfig[] = [];
  const margin = 14;
  const usableW = CARD_WIDTH - margin * 2;
  const usableH = CARD_HEIGHT - margin * 2;

  for (let i = 0; i < count; i++) {
    const w = 35 + Math.random() * (usableW * 0.4);
    const h = 8 + Math.random() * 12;
    const x = margin + Math.random() * (usableW - w);
    const y = margin + (i / count) * usableH * 0.85 + Math.random() * (usableH * 0.1);

    boxes.push({ x, y, width: w, height: h });
  }
  return boxes;
}

function DetectionBox({ config, beamY }: { config: DetectionBoxConfig; beamY: { value: number } }) {
  const beamTop = useDerivedValue(() => {
    return beamY.value * (CARD_HEIGHT - BEAM_HEIGHT);
  });

  const animatedStyle = useAnimatedStyle(() => {
    const beamBottom = beamTop.value + BEAM_HEIGHT;
    const boxCenter = config.y + config.height / 2;
    const isInBeam = boxCenter >= beamTop.value && boxCenter <= beamBottom;
    const distFromCenter = Math.abs(boxCenter - (beamTop.value + BEAM_HEIGHT / 2)) / (BEAM_HEIGHT / 2);
    const proximityOpacity = isInBeam ? interpolate(distFromCenter, [0, 0.6, 1], [0.9, 0.5, 0]) : 0;

    return {
      opacity: proximityOpacity,
      transform: [{ scaleX: isInBeam ? 1 : 0.4 }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: config.x,
          top: config.y,
          width: config.width,
          height: config.height,
          borderRadius: 3,
          borderWidth: 1.5,
          borderColor: CYAN_50,
          backgroundColor: "rgba(34, 211, 238, 0.08)",
        },
        animatedStyle,
      ]}
    />
  );
}

function TVStaticOverlay() {
  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);
  const noiseOpacity = useSharedValue(0.06);

  useEffect(() => {
    shiftX.value = withRepeat(
      withSequence(
        withTiming(40, { duration: 80 }),
        withTiming(-25, { duration: 70 }),
        withTiming(55, { duration: 90 }),
        withTiming(-40, { duration: 60 }),
        withTiming(15, { duration: 80 }),
        withTiming(-55, { duration: 70 }),
        withTiming(30, { duration: 90 }),
        withTiming(0, { duration: 60 }),
      ),
      -1,
      false
    );

    shiftY.value = withRepeat(
      withSequence(
        withTiming(-30, { duration: 70 }),
        withTiming(45, { duration: 90 }),
        withTiming(-50, { duration: 60 }),
        withTiming(20, { duration: 80 }),
        withTiming(-40, { duration: 70 }),
        withTiming(55, { duration: 90 }),
        withTiming(-15, { duration: 60 }),
        withTiming(0, { duration: 80 }),
      ),
      -1,
      false
    );

    noiseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.1, { duration: 120 }),
        withTiming(0.04, { duration: 100 }),
        withTiming(0.12, { duration: 80 }),
        withTiming(0.05, { duration: 150 }),
        withTiming(0.09, { duration: 90 }),
        withTiming(0.03, { duration: 110 }),
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(shiftX);
      cancelAnimation(shiftY);
      cancelAnimation(noiseOpacity);
    };
  }, []);

  const noiseStyle = useAnimatedStyle(() => ({
    opacity: noiseOpacity.value,
    transform: [
      { translateX: shiftX.value },
      { translateY: shiftY.value },
    ],
  }));

  return (
    <View style={styles.staticContainer} pointerEvents="none">
      <Animated.Image
        source={noiseTexture}
        style={[styles.noiseImage, noiseStyle]}
        resizeMode="repeat"
      />

      <View style={styles.scanLinesOverlay}>
        {Array.from({ length: SCANLINE_COUNT }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.scanLineRow,
              i % 2 === 0 && styles.scanLineRowVisible,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

interface ScanningAnimationProps {
  imageUri: string;
  statusText: string;
}

export default function ScanningAnimation({ imageUri, statusText }: ScanningAnimationProps) {
  const beamY = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);
  const textOpacity = useSharedValue(0);
  const imgScale = useSharedValue(BASE_SCALE);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const glitchOpacity = useSharedValue(0);
  const contrastOpacity = useSharedValue(0);
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detectionBoxes = useMemo(() => generateDetectionBoxes(NUM_DETECTION_BOXES), []);

  const doZoomCycle = useCallback(() => {
    const tx = (Math.random() - 0.5) * 2 * ZOOM_PAN_X;
    const ty = (Math.random() - 0.5) * 2 * ZOOM_PAN_Y;
    const zoomLevel = ZOOM_SCALE + (Math.random() - 0.5) * 0.3;

    imgScale.value = withSequence(
      withTiming(zoomLevel, { duration: 700, easing: Easing.out(Easing.cubic) }),
      withTiming(zoomLevel, { duration: 1200 }),
      withTiming(BASE_SCALE, { duration: 600, easing: Easing.inOut(Easing.cubic) }),
    );
    panX.value = withSequence(
      withTiming(tx, { duration: 700, easing: Easing.out(Easing.cubic) }),
      withTiming(tx, { duration: 1200 }),
      withTiming(0, { duration: 600, easing: Easing.inOut(Easing.cubic) }),
    );
    panY.value = withSequence(
      withTiming(ty, { duration: 700, easing: Easing.out(Easing.cubic) }),
      withTiming(ty, { duration: 1200 }),
      withTiming(0, { duration: 600, easing: Easing.inOut(Easing.cubic) }),
    );

    const holdBase = 600 + Math.random() * 800;
    zoomTimer.current = setTimeout(doZoomCycle, 2500 + holdBase);
  }, []);

  useEffect(() => {
    beamY.value = withRepeat(
      withSequence(
        withTiming(1, { duration: SCAN_DURATION, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: SCAN_DURATION * 0.7, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false
    );

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.15, { duration: 1000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );

    textOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.5, { duration: 800 })
      ),
      -1,
      false
    );

    glitchOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 2000 }),
        withTiming(0.6, { duration: 60 }),
        withTiming(0.15, { duration: 80 }),
        withTiming(0.7, { duration: 50 }),
        withTiming(0, { duration: 100 }),
        withTiming(0, { duration: 1400 }),
        withTiming(0.5, { duration: 70 }),
        withTiming(0.2, { duration: 60 }),
        withTiming(0.65, { duration: 50 }),
        withTiming(0, { duration: 120 }),
        withTiming(0, { duration: 2200 }),
        withTiming(0.55, { duration: 55 }),
        withTiming(0, { duration: 90 }),
        withTiming(0.45, { duration: 65 }),
        withTiming(0.1, { duration: 50 }),
        withTiming(0.6, { duration: 40 }),
        withTiming(0, { duration: 110 }),
        withTiming(0, { duration: 1800 }),
      ),
      -1,
      false
    );

    contrastOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 2000 }),
        withTiming(0.25, { duration: 60 }),
        withTiming(0.08, { duration: 80 }),
        withTiming(0.3, { duration: 50 }),
        withTiming(0, { duration: 100 }),
        withTiming(0, { duration: 1400 }),
        withTiming(0.2, { duration: 70 }),
        withTiming(0.1, { duration: 60 }),
        withTiming(0.28, { duration: 50 }),
        withTiming(0, { duration: 120 }),
        withTiming(0, { duration: 2200 }),
        withTiming(0.22, { duration: 55 }),
        withTiming(0, { duration: 90 }),
        withTiming(0.18, { duration: 65 }),
        withTiming(0.05, { duration: 50 }),
        withTiming(0.25, { duration: 40 }),
        withTiming(0, { duration: 110 }),
        withTiming(0, { duration: 1800 }),
      ),
      -1,
      false
    );

    zoomTimer.current = setTimeout(doZoomCycle, 1200);

    return () => {
      cancelAnimation(beamY);
      cancelAnimation(imgScale);
      cancelAnimation(panX);
      cancelAnimation(panY);
      cancelAnimation(glowOpacity);
      cancelAnimation(textOpacity);
      cancelAnimation(glitchOpacity);
      cancelAnimation(contrastOpacity);
      if (zoomTimer.current) clearTimeout(zoomTimer.current);
    };
  }, []);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: imgScale.value },
      { translateX: panX.value },
      { translateY: panY.value },
    ],
  }));

  const beamStyle = useAnimatedStyle(() => {
    const top = beamY.value * (CARD_HEIGHT - BEAM_HEIGHT);
    return {
      top,
      opacity: interpolate(beamY.value, [0, 0.05, 0.95, 1], [0.4, 1, 1, 0.4]),
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const glitchStyle = useAnimatedStyle(() => ({
    opacity: glitchOpacity.value,
  }));

  const contrastStyle = useAnimatedStyle(() => ({
    opacity: contrastOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.glowRing, glowStyle]}>
        <LinearGradient
          colors={["rgba(34, 211, 238, 0.2)", "rgba(99, 102, 241, 0.15)", "transparent"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      <View style={styles.cardContainer}>
        <Animated.Image
          source={{ uri: imageUri }}
          style={[styles.cardImage, styles.xrayImage, imageStyle]}
          resizeMode="cover"
        />

        <View style={styles.xrayTint} pointerEvents="none" />

        <TVStaticOverlay />

        <View style={styles.overlayContainer}>
          {detectionBoxes.map((config, i) => (
            <DetectionBox key={`db${i}`} config={config} beamY={beamY} />
          ))}
        </View>

        <Animated.View style={[styles.contrastOverlay, contrastStyle]} pointerEvents="none" />

        <Animated.View style={[styles.beam, beamStyle]} pointerEvents="none">
          <LinearGradient
            colors={[
              "rgba(34, 211, 238, 0)",
              "rgba(34, 211, 238, 0.03)",
              "rgba(34, 211, 238, 0.08)",
              "rgba(34, 211, 238, 0.25)",
              "rgba(34, 211, 238, 0.5)",
              CYAN,
            ]}
            locations={[0, 0.2, 0.4, 0.7, 0.9, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.beamEdge} />
        </Animated.View>

        <LinearGradient
          colors={["rgba(34, 211, 238, 0.12)", "transparent", "rgba(99, 102, 241, 0.1)"]}
          style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <Animated.View style={[styles.glitchOverlay, glitchStyle]} pointerEvents="none" />

        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />
      </View>

      <Animated.Text style={[styles.statusText, textStyle]}>
        {statusText}
      </Animated.Text>
    </View>
  );
}

const CORNER = { position: "absolute" as const, width: 20, height: 20, borderColor: CYAN };
const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  glowRing: {
    position: "absolute",
    width: CARD_WIDTH + 60,
    height: CARD_HEIGHT + 60,
    borderRadius: 30,
    overflow: "hidden",
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: CYAN_30,
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  xrayImage: isWeb
    ? { filter: "invert(1) contrast(1.4) brightness(1.1) saturate(0.15)" } as any
    : { opacity: 0.85, tintColor: CYAN } as any,
  xrayTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(34, 211, 238, 0.08)",
    ...(isWeb ? { mixBlendMode: "screen" } : {}),
  } as any,
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  staticContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  noiseImage: {
    position: "absolute",
    top: -60,
    left: -60,
    width: CARD_WIDTH + 120,
    height: CARD_HEIGHT + 120,
    tintColor: CYAN,
    ...(isWeb ? { filter: "invert(1) contrast(1.8)" } : {}),
  } as any,
  scanLinesOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scanLineRow: {
    height: 1.5,
    marginBottom: 1.5,
  },
  scanLineRowVisible: {
    backgroundColor: "rgba(0, 0, 0, 0.03)",
  },
  contrastOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  beam: {
    position: "absolute",
    left: 0,
    right: 0,
    height: BEAM_HEIGHT,
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
  },
  beamEdge: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: CYAN,
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  statusText: {
    marginTop: 28,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: CYAN,
    letterSpacing: 0.3,
  },
  glitchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(34, 211, 238, 0.4)",
    ...(isWeb ? { mixBlendMode: "difference" } : {}),
  } as any,
  cornerTL: { ...CORNER, top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { ...CORNER, top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { ...CORNER, bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { ...CORNER, bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2 },
});
