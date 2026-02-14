import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

const JOKES: { emoji: string; text: string }[] = [
  { emoji: "\u2709\uFE0F", text: "I\u2019m writing you a letter\u2026 because I miss your font face." },
  { emoji: "\uD83D\uDCEC", text: "Why did the postcard go to therapy? Too many issues to address." },
  { emoji: "\u2601\uFE0F", text: "Sending you a warm hello from the cloud!" },
  { emoji: "\uD83D\uDD0D", text: "Reading your handwriting better than your pharmacist." },
  { emoji: "\uD83C\uDF0D", text: "Translating memories\u2026 please hold." },
  { emoji: "\uD83D\uDCE8", text: "Stamping this with approval\u2026" },
  { emoji: "\uD83D\uDCF1", text: "Postcards: The original text message." },
];

const CYCLE_MS = 3500;
const FADE_MS = 400;

interface LoadingJokesProps {
  isVisible: boolean;
}

export default function LoadingJokes({ isVisible }: LoadingJokesProps) {
  const [jokeIndex, setJokeIndex] = useState(0);
  const opacity = useSharedValue(1);

  const advanceJoke = useCallback(() => {
    setJokeIndex((prev) => (prev + 1) % JOKES.length);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    setJokeIndex(0);
    opacity.value = withTiming(1, { duration: FADE_MS });

    const interval = setInterval(() => {
      opacity.value = withSequence(
        withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }, (finished) => {
          if (finished) runOnJS(advanceJoke)();
        }),
        withTiming(1, { duration: FADE_MS, easing: Easing.in(Easing.quad) })
      );
    }, CYCLE_MS);

    return () => clearInterval(interval);
  }, [isVisible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!isVisible) return null;

  const joke = JOKES[jokeIndex];

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.inner, animatedStyle]}>
        <Text style={styles.emoji}>{joke.emoji}</Text>
        <Text style={styles.jokeText}>{joke.text}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32,
    paddingTop: 20,
    alignItems: "center",
    height: 90,
    justifyContent: "center",
  },
  inner: {
    alignItems: "center",
    gap: 6,
  },
  emoji: {
    fontSize: 24,
  },
  jokeText: {
    fontFamily: "Caveat_500Medium",
    fontSize: 20,
    lineHeight: 28,
    color: Colors.light.slate500,
    textAlign: "center",
    letterSpacing: 0.2,
  },
});
