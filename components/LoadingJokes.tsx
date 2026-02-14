import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

const JOKES = [
  "I\u2019m writing you a letter\u2026 because I miss your font face.",
  "Why did the postcard go to therapy? It had too many issues to address.",
  "Sending you a warm hello from the cloud!",
  "This AI is reading your handwriting better than your pharmacist.",
  "Translating memories\u2026 please hold.",
  "Stamping this with approval\u2026",
  "Postcards: The original text message.",
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

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.jokeText, animatedStyle]}>
        {JOKES[jokeIndex]}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32,
    paddingTop: 20,
    alignItems: "center",
    height: 80,
    justifyContent: "center",
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
