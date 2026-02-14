import React, { useEffect, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

interface AnimatedWordProps {
  word: string;
  index: number;
  currentWordIndex: number;
  isPlaying: boolean;
  totalWords: number;
}

function AnimatedWord({ word, index, currentWordIndex, isPlaying }: AnimatedWordProps) {
  const opacity = useSharedValue(0.25);
  const scale = useSharedValue(0.95);
  const translateY = useSharedValue(4);

  useEffect(() => {
    if (!isPlaying) {
      opacity.value = withTiming(0.25, { duration: 300 });
      scale.value = withTiming(0.95, { duration: 300 });
      translateY.value = withTiming(4, { duration: 300 });
      return;
    }

    if (index < currentWordIndex) {
      opacity.value = withTiming(0.7, { duration: 200 });
      scale.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
    } else if (index === currentWordIndex) {
      opacity.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) });
      scale.value = withTiming(1.08, { duration: 200, easing: Easing.out(Easing.back(1.5)) });
      translateY.value = withTiming(-2, { duration: 200, easing: Easing.out(Easing.quad) });
    } else {
      opacity.value = withTiming(0.25, { duration: 200 });
      scale.value = withTiming(0.95, { duration: 200 });
      translateY.value = withTiming(4, { duration: 200 });
    }
  }, [currentWordIndex, isPlaying, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const isActive = isPlaying && index === currentWordIndex;

  return (
    <Animated.Text
      style={[
        styles.word,
        animatedStyle,
        isActive && styles.activeWord,
      ]}
    >
      {word}{" "}
    </Animated.Text>
  );
}

interface AnimatedTextProps {
  words: string[];
  currentWordIndex: number;
  isPlaying: boolean;
}

export default function AnimatedText({ words, currentWordIndex, isPlaying }: AnimatedTextProps) {
  return (
    <View style={styles.container}>
      {words.map((word, index) => (
        <AnimatedWord
          key={`${index}-${word}`}
          word={word}
          index={index}
          currentWordIndex={currentWordIndex}
          isPlaying={isPlaying}
          totalWords={words.length}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 4,
  },
  word: {
    fontSize: 20,
    lineHeight: 32,
    color: Colors.dark.accentLight,
    fontStyle: "italic",
    letterSpacing: 0.3,
  },
  activeWord: {
    color: Colors.dark.particleGold,
    textShadowColor: "rgba(255, 215, 0, 0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
