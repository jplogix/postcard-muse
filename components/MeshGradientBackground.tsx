import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Dimensions, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

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

  const blobSize = size * 1.4;
  const offset = (blobSize - size) / 2;

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: top - offset,
        left: left - offset,
        width: blobSize,
        height: blobSize,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    >
      {Platform.OS === "web" ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: blobSize / 2,
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
      ) : (
        <BlurView
          intensity={80}
          tint="default"
          experimentalBlurMethod="dimezisBlurView"
          style={[StyleSheet.absoluteFill, { borderRadius: blobSize / 2, overflow: "hidden" }]}
        >
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: blobSize / 2,
              backgroundColor: color,
              opacity: 0.3,
            }}
          />
        </BlurView>
      )}
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
