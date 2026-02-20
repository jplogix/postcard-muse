import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from "react-native-svg";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePostcards } from "@/lib/PostcardContext";
import PostcardThumbnail, {
  CARD_SIZE,
  GAP,
} from "@/components/PostcardThumbnail";
import MeshGradientBackground from "@/components/MeshGradientBackground";

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function HandwrittenHint({ bottomInset }: { bottomInset: number }) {
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(12);
  const arrowOpacity = useSharedValue(0);
  const arrowTranslateY = useSharedValue(8);
  const bobY = useSharedValue(0);

  useEffect(() => {
    textOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
    textTranslateY.value = withDelay(
      400,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
    arrowOpacity.value = withDelay(
      700,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    arrowTranslateY.value = withDelay(
      700,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    bobY.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
          withTiming(4, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [
      { translateY: textTranslateY.value },
      { translateY: bobY.value },
    ],
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value,
    transform: [
      { translateY: arrowTranslateY.value },
      { translateY: bobY.value },
    ],
  }));

  return (
    <View
      style={[hintStyles.container, { bottom: bottomInset + 90 }]}
      pointerEvents="none"
    >
      <Animated.Text style={[hintStyles.text, textStyle]}>
        Tap here to start!
      </Animated.Text>
      <Animated.View style={[hintStyles.arrowWrap, arrowStyle]}>
        <Svg width={60} height={50} viewBox="0 0 60 50">
          <Path
            d="M10 4 C18 4, 30 6, 38 16 C46 26, 48 36, 46 44"
            stroke={Colors.light.accent}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeDasharray="4,3"
          />
          <Path
            d="M40 40 L46 46 L50 38"
            stroke={Colors.light.accent}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const hintStyles = StyleSheet.create({
  container: {
    position: "absolute",
    right: Platform.OS === "web" ? 28 : 21,
    alignItems: "flex-end",
  },
  text: {
    fontFamily: "Caveat_500Medium",
    fontSize: 20,
    color: Colors.light.accent,
    marginBottom: -2,
    transform: [{ rotate: "-3deg" }],
  },
  arrowWrap: {
    marginRight: 6,
  },
});

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const { postcards, isLoading, refresh } = usePostcards();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/add");
  };

  const handleSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/settings");
  };

  const renderItem = ({ item }: { item: any }) => (
    <PostcardThumbnail
      postcard={item}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/detail/[id]", params: { id: item.id } });
      }}
    />
  );

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <MeshGradientBackground />

      <View style={styles.headerOuter}>
        <BlurView intensity={60} tint="light" style={styles.headerBlur}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={{ transform: [{ rotate: "-8deg" }] }}>
                <Svg width={32} height={26} viewBox="-6 0 22 16">
                  <Defs>
                    <SvgGradient id="postcardGrad" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor={Colors.light.accent} />
                      <Stop offset="1" stopColor={Colors.light.pink} />
                    </SvgGradient>
                  </Defs>
                  <Path
                    stroke={Colors.light.accent}
                    strokeWidth="0.8"
                    strokeLinecap="round"
                    opacity="0.5"
                    d="M-1.5 5.5h-3"
                  />
                  <Path
                    stroke={Colors.light.accent}
                    strokeWidth="0.8"
                    strokeLinecap="round"
                    opacity="0.4"
                    d="M-2 8h-2.5"
                  />
                  <Path
                    stroke={Colors.light.accent}
                    strokeWidth="0.8"
                    strokeLinecap="round"
                    opacity="0.3"
                    d="M-1.5 10.5h-2"
                  />
                  <Path
                    fill="url(#postcardGrad)"
                    d="M2 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm6 2.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0m3.5.878c1.482-1.42 4.795 1.392 0 4.622c-4.795-3.23-1.482-6.043 0-4.622M2 5.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5"
                  />
                </Svg>
              </View>
              <Text style={styles.brandText}>Postcard Muse</Text>
            </View>
            <Pressable
              onPress={handleSettings}
              hitSlop={12}
              style={styles.headerIconBtn}
              testID="settings-button"
            >
              <Feather
                name="settings"
                size={20}
                color={Colors.light.textSecondary}
              />
            </Pressable>
          </View>
        </BlurView>
      </View>

      {postcards.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons
              name="mail-open-outline"
              size={40}
              color={Colors.light.textMuted}
            />
          </View>
          <Text style={styles.emptyTitle}>No postcards yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the button below to scan your first postcard
          </Text>
        </View>
      ) : (
        <FlatList
          data={postcards}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomInset + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          onRefresh={refresh}
          refreshing={isLoading}
        />
      )}

      {postcards.length === 0 && !isLoading && (
        <HandwrittenHint bottomInset={bottomInset} />
      )}

      <Pressable
        onPress={handleAdd}
        testID="add-button"
        style={({ pressed }) => [
          styles.fab,
          { bottom: bottomInset + 24 },
          pressed && { transform: [{ scale: 0.92 }], opacity: 0.9 },
        ]}
      >
        <BlurView intensity={50} tint="light" style={styles.fabBlur}>
          <Ionicons name="scan" size={24} color={Colors.light.accent} />
        </BlurView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  headerOuter: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 24,
    overflow: "hidden",
  },
  headerBlur: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandText: {
    fontSize: 17,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    paddingHorizontal: 20,
    gap: GAP,
    marginBottom: GAP,
  },
  listContent: {
    paddingTop: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.slate100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.slate200,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  fab: {
    position: "absolute",
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  fabBlur: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
});
