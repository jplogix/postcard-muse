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
const NUM_SONAR_RINGS = 3;
const IMAGE_SCALE = 1.35;
const PAN_RANGE_X = CARD_WIDTH * (IMAGE_SCALE - 1) * 0.45;
const PAN_RANGE_Y = CARD_HEIGHT * (IMAGE_SCALE - 1) * 0.45;
const SONAR_MAX = Math.max(CARD_WIDTH, CARD_HEIGHT) * 0.9;

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

function SonarRing({ index }: { index: number }) {
  const progress = useSharedValue(0);
  const delay = index * 1200;
  const duration = NUM_SONAR_RINGS * 1200;

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );

    return () => cancelAnimation(progress);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const size = interpolate(progress.value, [0, 1], [0, SONAR_MAX]);
    const opacity = interpolate(progress.value, [0, 0.15, 0.6, 1], [0, 0.35, 0.12, 0]);

    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      opacity,
      transform: [
        { translateX: -size / 2 },
        { translateY: -size / 2 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: CARD_WIDTH / 2,
          top: CARD_HEIGHT / 2,
          borderWidth: 1.5,
          borderColor: "rgba(99, 102, 241, 0.5)",
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

  const textBlockConfigs = useMemo(() => generateTextBlockConfigs(NUM_TEXT_BLOCKS), []);
  const sonarIndices = useMemo(() => Array.from({ length: NUM_SONAR_RINGS }, (_, i) => i), []);

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
        withTiming(0, { duration: 3200 }),
        withTiming(0.55, { duration: 80 }),
        withTiming(0, { duration: 120 }),
        withTiming(0.4, { duration: 60 }),
        withTiming(0, { duration: 100 }),
        withTiming(0, { duration: 4500 }),
        withTiming(0.5, { duration: 70 }),
        withTiming(0, { duration: 150 }),
        withTiming(0, { duration: 2800 }),
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

        <View style={styles.overlayContainer}>
          {sonarIndices.map((i) => (
            <SonarRing key={`s${i}`} index={i} />
          ))}
          {textBlockConfigs.map((config, i) => (
            <TextBlockOutline key={`tb${i}`} config={config} />
          ))}
        </View>

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
    backgroundColor: "rgba(99, 102, 241, 0.35)",
    mixBlendMode: "difference" as any,
  },
  cornerTL: { ...CORNER, top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { ...CORNER, top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { ...CORNER, bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { ...CORNER, bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2 },
});
