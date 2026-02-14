import React, { useState } from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_HEIGHT = CARD_WIDTH * 0.65;

interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
}

export default function FlipCard({ front, back }: FlipCardProps) {
  const rotation = useSharedValue(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const toValue = isFlipped ? 0 : 180;
    rotation.value = withTiming(toValue, {
      duration: 600,
      easing: Easing.inOut(Easing.cubic),
    });
    setIsFlipped(!isFlipped);
  };

  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(rotation.value, [0, 180], [0, 180]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: "hidden" as const,
      opacity: interpolate(rotation.value, [0, 89, 90, 180], [1, 1, 0, 0]),
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(rotation.value, [0, 180], [180, 360]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: "hidden" as const,
      opacity: interpolate(rotation.value, [0, 89, 90, 180], [0, 0, 1, 1]),
    };
  });

  return (
    <Pressable onPress={handleFlip} style={styles.container}>
      <Animated.View style={[styles.card, frontStyle]}>
        {front}
      </Animated.View>
      <Animated.View style={[styles.card, styles.cardBack, backStyle]}>
        {back}
      </Animated.View>
    </Pressable>
  );
}

export { CARD_WIDTH, CARD_HEIGHT };

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: "center",
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    position: "absolute",
  },
  cardBack: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
