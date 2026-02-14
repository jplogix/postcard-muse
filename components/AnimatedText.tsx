import React, { useEffect, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

interface AnimatedWordProps {
  word: string;
  index: number;
  currentWordIndex: number;
  isPlaying: boolean;
  hasPlayed: boolean;
  afterPause: boolean;
  totalWords: number;
}

function AnimatedWord({ word, index, currentWordIndex, isPlaying, hasPlayed, afterPause, totalWords }: AnimatedWordProps) {
  const progress = useSharedValue(0);
  const highlight = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (hasPlayed && !isPlaying) {
      progress.value = withTiming(1, { duration: 200 });
      highlight.value = withTiming(0, { duration: 200 });
      fade.value = withTiming(1, { duration: 300 });
      return;
    }

    if (!isPlaying && !hasPlayed) {
      progress.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) });
      highlight.value = withTiming(0, { duration: 200 });
      fade.value = withTiming(1, { duration: 200 });
      return;
    }

    if (index <= currentWordIndex) {
      if (afterPause && index === currentWordIndex) {
        progress.value = withDelay(80, withSpring(1, { damping: 18, stiffness: 80, mass: 1.1 }));
      } else if (index === currentWordIndex) {
        progress.value = withSpring(1, { damping: 14, stiffness: 120, mass: 0.8 });
      } else {
        progress.value = withTiming(1, { duration: 150 });
      }

      const lag = currentWordIndex - index;
      if (lag > 8) {
        fade.value = withTiming(0.35, { duration: 600, easing: Easing.out(Easing.quad) });
      } else if (lag > 5) {
        fade.value = withTiming(0.55, { duration: 500, easing: Easing.out(Easing.quad) });
      } else if (lag > 3) {
        fade.value = withTiming(0.75, { duration: 400, easing: Easing.out(Easing.quad) });
      } else {
        fade.value = withTiming(1, { duration: 250 });
      }
    } else {
      progress.value = withTiming(0, { duration: 200 });
      fade.value = withTiming(1, { duration: 200 });
    }

    if (index === currentWordIndex) {
      const highlightDur = afterPause ? 220 : 150;
      highlight.value = afterPause
        ? withDelay(80, withTiming(1, { duration: highlightDur }))
        : withTiming(1, { duration: highlightDur });
    } else {
      highlight.value = withTiming(0, { duration: 250 });
    }
  }, [currentWordIndex, isPlaying, hasPlayed, index, afterPause]);

  const animatedStyle = useAnimatedStyle(() => {
    const baseOpacity = interpolate(progress.value, [0, 0.3, 1], [0, 0.4, 1]);
    const opacity = baseOpacity * fade.value;
    const translateY = interpolate(progress.value, [0, 1], [6, 0]);
    const scale = interpolate(highlight.value, [0, 1], [1, 1.06]);

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
  hasPlayed: boolean;
  wordTimings?: number[] | null;
}

export default function AnimatedText({ words, currentWordIndex, isPlaying, hasPlayed, wordTimings }: AnimatedTextProps) {
  const pauseFlags = useMemo(() => {
    return words.map((_, i) => {
      if (i === 0) return false;
      const prev = words[i - 1].trimEnd();
      const lastChar = prev[prev.length - 1];
      return ".!?,;:".includes(lastChar);
    });
  }, [words]);

  return (
    <View style={styles.container}>
      {words.map((word, index) => (
        <AnimatedWord
          key={`${index}-${word}`}
          word={word}
          index={index}
          currentWordIndex={currentWordIndex}
          isPlaying={isPlaying}
          hasPlayed={hasPlayed}
          afterPause={pauseFlags[index]}
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
    lineHeight: 34,
    fontFamily: "Caveat_500Medium",
    color: Colors.light.slate700,
    letterSpacing: 0.3,
  },
});
