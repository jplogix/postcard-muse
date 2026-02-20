import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

const DOT_SIZE = 8;
const ANIMATION_DURATION = 600;

interface LoadingDotsProps {
  color?: string;
  size?: "small" | "medium" | "large";
}

function Dot({ index, color, size }: { index: number; color: string; size: "small" | "medium" | "large" }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  const baseDelay = index * 150;
  const sizeMultiplier = size === "small" ? 0.75 : size === "large" ? 1.25 : 1;

  React.useEffect(() => {
    const offsetDelay = index * 150;

    scale.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: ANIMATION_DURATION, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: ANIMATION_DURATION, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );

    opacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: ANIMATION_DURATION, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: ANIMATION_DURATION, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * sizeMultiplier }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { width: DOT_SIZE * sizeMultiplier, height: DOT_SIZE * sizeMultiplier, backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

export default function LoadingDots({ color = Colors.light.accent, size = "medium" }: LoadingDotsProps) {
  return (
    <View style={styles.container}>
      <Dot index={0} color={color} size={size} />
      <Dot index={1} color={color} size={size} />
      <Dot index={2} color={color} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    borderRadius: 4,
  },
});
