import React, { useEffect, useMemo } from "react";
import { View, StyleSheet, TextStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

interface AnimatedCharProps {
  char: string;
  index: number;
  staggerMs: number;
  initialDelay: number;
  textStyle?: TextStyle;
  trigger: number;
}

function AnimatedChar({ char, index, staggerMs, initialDelay, textStyle, trigger }: AnimatedCharProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    opacity.value = 0;
    translateY.value = 10;

    const charDelay = initialDelay + index * staggerMs;
    opacity.value = withDelay(charDelay, withSpring(1, { damping: 12, stiffness: 100 }));
    translateY.value = withDelay(charDelay, withSpring(0, { damping: 12, stiffness: 100 }));
  }, [trigger]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (char === " ") {
    return <Animated.Text style={[styles.char, textStyle, animatedStyle]}>{"\u00A0"}</Animated.Text>;
  }

  return (
    <Animated.Text style={[styles.char, textStyle, animatedStyle]}>
      {char}
    </Animated.Text>
  );
}

function BlinkingCursor({ delay, textStyle }: { delay: number; textStyle?: TextStyle }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 0 }),
          withTiming(1, { duration: 400 }),
          withTiming(0, { duration: 100 }),
          withTiming(0, { duration: 400 }),
        ),
        -1,
        false
      )
    );

    return () => cancelAnimation(opacity);
  }, [delay]);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const fontSize = textStyle?.fontSize ?? 24;
  const lineHeight = textStyle?.lineHeight ?? 36;

  return (
    <Animated.View
      style={[
        {
          width: 2.5,
          height: fontSize * 0.85,
          backgroundColor: Colors.light.accent,
          borderRadius: 1.5,
          marginLeft: 1,
          alignSelf: "center" as const,
          marginTop: (lineHeight - fontSize * 0.85) / 2,
        },
        cursorStyle,
      ]}
    />
  );
}

interface HandwritingAnimatorProps {
  text: string;
  textStyle?: TextStyle;
  delay?: number;
  showCursor?: boolean;
}

export default function HandwritingAnimator({ text, textStyle, delay = 0, showCursor = true }: HandwritingAnimatorProps) {
  const chars = useMemo(() => text.split(""), [text]);
  const staggerMs = 50;
  const initialDelayMs = delay * 40;
  const trigger = useMemo(() => Date.now(), [text]);
  const totalAnimTime = initialDelayMs + chars.length * staggerMs;

  return (
    <View style={styles.container}>
      {chars.map((char, index) => (
        <AnimatedChar
          key={`${trigger}-${index}`}
          char={char}
          index={index}
          staggerMs={staggerMs}
          initialDelay={initialDelayMs}
          textStyle={textStyle}
          trigger={trigger}
        />
      ))}
      {showCursor && (
        <BlinkingCursor delay={totalAnimTime * 0.3} textStyle={textStyle} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  char: {
    fontSize: 24,
    lineHeight: 36,
    fontFamily: "Caveat_400Regular",
    color: Colors.light.handwriting,
  },
});
