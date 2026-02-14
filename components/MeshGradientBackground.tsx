import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

function Blob({ color, size, initialX, initialY, delay }: {
  color: string;
  size: number;
  initialX: number;
  initialY: number;
  delay: number;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const duration = 7000;
    translateX.value = withRepeat(
      withSequence(
        withTiming(30, { duration: duration * 0.33, easing: Easing.inOut(Easing.quad) }),
        withTiming(-20, { duration: duration * 0.33, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: duration * 0.34, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(-50, { duration: duration * 0.33, easing: Easing.inOut(Easing.quad) }),
        withTiming(20, { duration: duration * 0.33, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: duration * 0.34, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: duration * 0.33, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.9, { duration: duration * 0.33, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: duration * 0.34, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
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
          left: initialX,
          top: initialY,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function MeshGradientBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Blob
        color={Colors.light.blobPurple}
        size={SCREEN_WIDTH * 0.85}
        initialX={SCREEN_WIDTH * 0.1}
        initialY={-SCREEN_HEIGHT * 0.05}
        delay={0}
      />
      <Blob
        color={Colors.light.blobIndigo}
        size={SCREEN_WIDTH * 0.85}
        initialX={SCREEN_WIDTH * 0.4}
        initialY={-SCREEN_HEIGHT * 0.02}
        delay={2000}
      />
      <Blob
        color={Colors.light.blobPink}
        size={SCREEN_WIDTH * 0.85}
        initialX={SCREEN_WIDTH * 0.15}
        initialY={SCREEN_HEIGHT * 0.55}
        delay={4000}
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
