import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Dimensions } from "react-native";

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
    const duration = 7000;

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
        Animated.timing(scale, { toValue: 1.1, duration: duration * 0.33, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.9, duration: duration * 0.33, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: duration * 0.34, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute",
        top,
        left,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: 0.3,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    />
  );
}

export default function MeshGradientBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Blob
        color="#E9D5FF"
        size={300}
        top={50}
        left={80}
      />
      <Blob
        color="#C7D2FE"
        size={300}
        top={-20}
        left={SCREEN_WIDTH * 0.4}
      />
      <Blob
        color="#FBCFE8"
        size={300}
        top={SCREEN_HEIGHT * 0.55}
        left={SCREEN_WIDTH * 0.15}
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
