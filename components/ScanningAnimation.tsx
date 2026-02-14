import React, { useEffect, useRef, useMemo } from "react";
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
const NUM_STATIC_PARTICLES = 60;

const PARTICLE_COLORS = [
  Colors.light.particleIndigo,
  Colors.light.particlePurple,
  Colors.light.particlePink,
  Colors.light.particleCyan,
  Colors.light.accentLight,
];

interface ParticleConfig {
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  flickerDuration: number;
  driftX: number;
  driftY: number;
}

function generateParticleConfigs(count: number): ParticleConfig[] {
  const configs: ParticleConfig[] = [];
  for (let i = 0; i < count; i++) {
    configs.push({
      x: Math.random() * (CARD_WIDTH - 4) + 2,
      y: Math.random() * (CARD_HEIGHT - 4) + 2,
      size: 1.5 + Math.random() * 2,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      delay: Math.random() * 2000,
      flickerDuration: 400 + Math.random() * 800,
      driftX: (Math.random() - 0.5) * 12,
      driftY: (Math.random() - 0.5) * 12,
    });
  }
  return configs;
}

interface StaticParticleProps {
  config: ParticleConfig;
}

function StaticParticle({ config }: StaticParticleProps) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(0.85, { duration: config.flickerDuration * 0.25, easing: Easing.out(Easing.quad) }),
          withTiming(0.3, { duration: config.flickerDuration * 0.2 }),
          withTiming(0.9, { duration: config.flickerDuration * 0.15, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: config.flickerDuration * 0.4, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      )
    );

    translateX.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(config.driftX, { duration: config.flickerDuration, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      )
    );

    translateY.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(config.driftY, { duration: config.flickerDuration, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      )
    );

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: config.x,
          top: config.y,
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: config.color,
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

  const particleConfigs = useMemo(() => generateParticleConfigs(NUM_STATIC_PARTICLES), []);

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
          {particleConfigs.map((config, i) => (
            <StaticParticle key={i} config={config} />
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
