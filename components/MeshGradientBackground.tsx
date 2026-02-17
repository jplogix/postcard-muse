import React, { useEffect, useRef, useMemo } from "react";
import { View, Animated, StyleSheet, Dimensions, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const RING_COUNT = 8;

function Blob({ color, size, top, left }: {
  color: string;
  size: number;
  top: number;
  left: number;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const duration = 8000;

    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: 30, duration: duration * 0.33, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -20, duration: duration * 0.33, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: duration * 0.34, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -50, duration: duration * 0.33, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: duration * 0.33, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: duration * 0.34, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: duration * 0.33, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.9, duration: duration * 0.33, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: duration * 0.34, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const outerSize = size * 1.6;
  const offsetX = left - (outerSize - size) / 2;
  const offsetY = top - (outerSize - size) / 2;

  const rings = useMemo(() => {
    const result = [];
    for (let i = 0; i < RING_COUNT; i++) {
      const t = i / (RING_COUNT - 1);
      const ringScale = 0.25 + t * 0.75;
      const ringSize = outerSize * ringScale;
      const ringOffset = (outerSize - ringSize) / 2;
      const opacity = 0.35 * (1 - t * t);
      result.push({ ringSize, ringOffset, opacity, key: i });
    }
    return result;
  }, [outerSize]);

  if (Platform.OS === "web") {
    return (
      <Animated.View
        style={{
          position: "absolute",
          top: offsetY,
          left: offsetX,
          width: outerSize,
          height: outerSize,
          transform: [{ translateX }, { translateY }, { scale }],
        }}
      >
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: outerSize / 2,
              overflow: "hidden",
              filter: `blur(${size * 0.35}px)`,
            } as any,
          ]}
        >
          <LinearGradient
            colors={[color + "00", color + "50", color + "70", color + "50", color + "00"]}
            locations={[0, 0.2, 0.5, 0.8, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[color + "00", color + "40", color + "60", color + "40", color + "00"]}
            locations={[0, 0.2, 0.5, 0.8, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: offsetY,
        left: offsetX,
        width: outerSize,
        height: outerSize,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    >
      {rings.map((ring) => (
        <View
          key={ring.key}
          style={{
            position: "absolute",
            top: ring.ringOffset,
            left: ring.ringOffset,
            width: ring.ringSize,
            height: ring.ringSize,
            borderRadius: ring.ringSize / 2,
            backgroundColor: color,
            opacity: ring.opacity,
          }}
        />
      ))}
    </Animated.View>
  );
}

export default function MeshGradientBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Blob
        color="#D8B4FE"
        size={350}
        top={30}
        left={60}
      />
      <Blob
        color="#A5B4FC"
        size={320}
        top={-40}
        left={SCREEN_WIDTH * 0.35}
      />
      <Blob
        color="#F9A8D4"
        size={340}
        top={SCREEN_HEIGHT * 0.5}
        left={SCREEN_WIDTH * 0.1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
});
