import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  interpolate,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

interface AnimatedWordProps {
  word: string;
  index: number;
  currentWordIndex: number;
  isPlaying: boolean;
}

function AnimatedWord({ word, index, currentWordIndex, isPlaying }: AnimatedWordProps) {
  const progress = useSharedValue(0);
  const highlight = useSharedValue(0);

  useEffect(() => {
    if (!isPlaying) {
      progress.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) });
      highlight.value = withTiming(0, { duration: 200 });
      return;
    }

    if (index <= currentWordIndex) {
      progress.value = withSpring(1, { damping: 14, stiffness: 120, mass: 0.8 });
    } else {
      progress.value = withTiming(0, { duration: 200 });
    }

    if (index === currentWordIndex) {
      highlight.value = withTiming(1, { duration: 150 });
    } else {
      highlight.value = withTiming(0, { duration: 250 });
    }
  }, [currentWordIndex, isPlaying, index]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.3, 1], [0, 0.4, 1]);
    const translateY = interpolate(progress.value, [0, 1], [8, 0]);
    const scale = interpolate(highlight.value, [0, 1], [1, 1.08]);

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  const colorStyle = useAnimatedStyle(() => {
    const color = highlight.value > 0.5 ? Colors.light.accent : Colors.light.slate700;
    return { color };
  });

  return (
    <Animated.Text style={[styles.word, animatedStyle, colorStyle]}>
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
    lineHeight: 34,
    fontFamily: "Caveat_500Medium",
    color: Colors.light.slate700,
    letterSpacing: 0.3,
  },
});
