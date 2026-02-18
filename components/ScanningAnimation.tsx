import React, { useEffect, useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
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
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.75;
const CARD_HEIGHT = CARD_WIDTH * 0.65;
const NUM_TEXT_BLOCKS = 6;
const IMAGE_SCALE = 1.35;
const PAN_RANGE_X = CARD_WIDTH * (IMAGE_SCALE - 1) * 0.45;
const PAN_RANGE_Y = CARD_HEIGHT * (IMAGE_SCALE - 1) * 0.45;

const GRID_COLS = 12;
const GRID_ROWS = Math.round((CARD_HEIGHT / CARD_WIDTH) * GRID_COLS);
const CELL_W = CARD_WIDTH / GRID_COLS;
const CELL_H = CARD_HEIGHT / GRID_ROWS;
const CELL_GAP = 1;

const BLOCK_COLORS = [
  "rgba(99, 102, 241, 0.5)",
  "rgba(167, 139, 250, 0.5)",
  "rgba(244, 114, 182, 0.45)",
  "rgba(34, 211, 238, 0.45)",
  "rgba(129, 140, 248, 0.5)",
  "rgba(167, 139, 250, 0.45)",
];

interface TextBlockConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  delay: number;
  cycleDuration: number;
}

function generateTextBlockConfigs(count: number): TextBlockConfig[] {
  const configs: TextBlockConfig[] = [];
  const margin = 16;
  const usableW = CARD_WIDTH - margin * 2;
  const usableH = CARD_HEIGHT - margin * 2;

  for (let i = 0; i < count; i++) {
    const w = 40 + Math.random() * (usableW * 0.45);
    const h = 8 + Math.random() * 14;
    const x = margin + Math.random() * (usableW - w);
    const y = margin + Math.random() * (usableH - h);
    const stagger = i * 1800;
    const cycleDuration = count * 1800;

    configs.push({
      x, y, width: w, height: h,
      color: BLOCK_COLORS[i % BLOCK_COLORS.length],
      delay: stagger,
      cycleDuration,
    });
  }
  return configs;
}

interface FlickeringCellConfig {
  col: number;
  row: number;
  delay: number;
  onDuration: number;
  offDuration: number;
  maxOpacity: number;
}

function generateFlickerConfigs(): FlickeringCellConfig[] {
  const configs: FlickeringCellConfig[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      configs.push({
        col: c,
        row: r,
        delay: Math.random() * 3000,
        onDuration: 300 + Math.random() * 800,
        offDuration: 400 + Math.random() * 2200,
        maxOpacity: 0.06 + Math.random() * 0.1,
      });
    }
  }
  return configs;
}

function FlickeringCell({ config }: { config: FlickeringCellConfig }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(config.maxOpacity, { duration: config.onDuration * 0.3, easing: Easing.out(Easing.quad) }),
          withTiming(config.maxOpacity * 0.6, { duration: config.onDuration * 0.7 }),
          withTiming(0, { duration: config.onDuration * 0.2, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: config.offDuration })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(opacity);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: config.col * CELL_W + CELL_GAP,
          top: config.row * CELL_H + CELL_GAP,
          width: CELL_W - CELL_GAP * 2,
          height: CELL_H - CELL_GAP * 2,
          borderRadius: 2,
          backgroundColor: Colors.light.accent,
        },
        animatedStyle,
      ]}
    />
  );
}

function TextBlockOutline({ config }: { config: TextBlockConfig }) {
  const opacity = useSharedValue(0);
  const scaleX = useSharedValue(0.3);

  useEffect(() => {
    const showDuration = 1200;
    const hideDuration = config.cycleDuration - showDuration;

    opacity.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
          withTiming(0.7, { duration: showDuration - 360 }),
          withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: hideDuration })
        ),
        -1,
        false
      )
    );

    scaleX.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: showDuration - 250 }),
          withTiming(0.3, { duration: 180 }),
          withTiming(0.3, { duration: config.cycleDuration - showDuration })
        ),
        -1,
        false
      )
    );

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scaleX);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scaleX: scaleX.value }],
  }));

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
          borderColor: config.color,
          backgroundColor: config.color.replace(/[\d.]+\)$/, "0.08)"),
        },
        animatedStyle,
      ]}
    />
  );
}

interface ScanningAnimationProps {
  imageUri: string;
  statusText: string;
}

export default function ScanningAnimation({ imageUri, statusText }: ScanningAnimationProps) {
  const scanLineY = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);
  const textOpacity = useSharedValue(0);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const glitchOpacity = useSharedValue(0);
  const contrastOpacity = useSharedValue(0);

  const textBlockConfigs = useMemo(() => generateTextBlockConfigs(NUM_TEXT_BLOCKS), []);
  const flickerConfigs = useMemo(() => generateFlickerConfigs(), []);

  useEffect(() => {
    scanLineY.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );

    panX.value = withRepeat(
      withSequence(
        withTiming(-PAN_RANGE_X * 0.6, { duration: 3500, easing: Easing.inOut(Easing.cubic) }),
        withTiming(PAN_RANGE_X * 0.5, { duration: 4000, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      false
    );

    panY.value = withRepeat(
      withSequence(
        withTiming(-PAN_RANGE_Y * 0.5, { duration: 4000, easing: Easing.inOut(Easing.cubic) }),
        withTiming(PAN_RANGE_Y * 0.5, { duration: 3500, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.cubic) }),
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

    return () => {
      cancelAnimation(scanLineY);
      cancelAnimation(panX);
      cancelAnimation(panY);
      cancelAnimation(glowOpacity);
      cancelAnimation(textOpacity);
      cancelAnimation(glitchOpacity);
      cancelAnimation(contrastOpacity);
    };
  }, []);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: IMAGE_SCALE },
      { translateX: panX.value },
      { translateY: panY.value },
    ],
  }));

  const scanLineStyle = useAnimatedStyle(() => ({
    top: interpolate(scanLineY.value, [0, 1], [0, CARD_HEIGHT - 2]),
    opacity: interpolate(scanLineY.value, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
  }));

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
          colors={["rgba(99, 102, 241, 0.2)", "rgba(236, 72, 153, 0.15)", "transparent"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      <View style={styles.cardContainer}>
        <Animated.Image
          source={{ uri: imageUri }}
          style={[styles.cardImage, imageStyle]}
          resizeMode="cover"
        />

        <View style={styles.overlayContainer} pointerEvents="none">
          {flickerConfigs.map((config, i) => (
            <FlickeringCell key={`fc${i}`} config={config} />
          ))}
        </View>

        <View style={styles.overlayContainer}>
          {textBlockConfigs.map((config, i) => (
            <TextBlockOutline key={`tb${i}`} config={config} />
          ))}
        </View>

        <Animated.View style={[styles.contrastOverlay, contrastStyle]} pointerEvents="none" />

        <Animated.View style={[styles.scanLine, scanLineStyle]}>
          <LinearGradient
            colors={["transparent", Colors.light.accent, "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <LinearGradient
          colors={["rgba(99, 102, 241, 0.1)", "transparent", "rgba(236, 72, 153, 0.1)"]}
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

const CORNER = { position: "absolute" as const, width: 20, height: 20, borderColor: Colors.light.accent };
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
    borderColor: "rgba(99, 102, 241, 0.3)",
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  contrastOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
  },
  statusText: {
    marginTop: 28,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.accent,
    letterSpacing: 0.3,
  },
  glitchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(99, 102, 241, 0.4)",
    mixBlendMode: "difference" as any,
  },
  cornerTL: { ...CORNER, top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { ...CORNER, top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { ...CORNER, bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { ...CORNER, bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2 },
});
