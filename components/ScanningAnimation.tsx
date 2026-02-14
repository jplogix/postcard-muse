import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, Image } from "react-native";
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
const NUM_PARTICLES = 24;

interface ParticleProps {
  index: number;
  scanProgress: Animated.SharedValue<number>;
}

function Particle({ index, scanProgress }: ParticleProps) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0);

  const side = index % 4;
  const baseX =
    side === 0
      ? Math.random() * CARD_WIDTH
      : side === 1
        ? Math.random() * CARD_WIDTH
        : side === 2
          ? 0
          : CARD_WIDTH;
  const baseY =
    side === 0
      ? 0
      : side === 1
        ? CARD_HEIGHT
        : Math.random() * CARD_HEIGHT;

  const driftX = (Math.random() - 0.5) * 60;
  const driftY = (Math.random() - 0.5) * 60;
  const delay = index * 120 + Math.random() * 400;
  const duration = 1800 + Math.random() * 1200;

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.9, { duration: duration * 0.3, easing: Easing.out(Easing.quad) }),
          withTiming(0.6, { duration: duration * 0.4, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: duration * 0.3, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      )
    );

    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(driftX * 0.5, { duration: duration * 0.5, easing: Easing.out(Easing.quad) }),
          withTiming(driftX, { duration: duration * 0.5, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      )
    );

    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(driftY - 20, { duration: duration * 0.6, easing: Easing.out(Easing.quad) }),
          withTiming(driftY, { duration: duration * 0.4, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      )
    );

    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: duration * 0.3, easing: Easing.out(Easing.back(2)) }),
          withTiming(0.6, { duration: duration * 0.4 }),
          withTiming(0, { duration: duration * 0.3 })
        ),
        -1,
        false
      )
    );

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(scale);
    };
  }, []);

  const colors = [
    Colors.light.particleIndigo,
    Colors.light.particlePurple,
    Colors.light.particlePink,
    Colors.light.particleCyan,
    Colors.light.accentLight,
  ];

  const color = colors[index % colors.length];
  const size = 3 + Math.random() * 5;

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: baseX,
          top: baseY,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: size,
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
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    scanLineY.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );

    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) })
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

    return () => {
      cancelAnimation(scanLineY);
      cancelAnimation(pulseScale);
      cancelAnimation(glowOpacity);
      cancelAnimation(textOpacity);
    };
  }, []);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
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

  const particles = useRef(
    Array.from({ length: NUM_PARTICLES }, (_, i) => i)
  ).current;

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

      <Animated.View style={[styles.cardContainer, cardAnimatedStyle]}>
        <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />

        <View style={styles.particlesContainer}>
          {particles.map((i) => (
            <Particle key={i} index={i} scanProgress={scanLineY} />
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

        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />
      </Animated.View>

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
  particlesContainer: {
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
  cornerTL: { ...CORNER, top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { ...CORNER, top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { ...CORNER, bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { ...CORNER, bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2 },
});
