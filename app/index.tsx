import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePostcards } from "@/lib/PostcardContext";
import PostcardThumbnail, { CARD_SIZE, GAP } from "@/components/PostcardThumbnail";
import MeshGradientBackground from "@/components/MeshGradientBackground";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
              <Ionicons name="heart-outline" size={22} color={Colors.light.text} />
              <Text style={styles.brandText}>Postcard Muse</Text>
            </View>
            <Pressable onPress={handleSettings} hitSlop={12} style={styles.headerIconBtn} testID="settings-button">
              <Feather name="settings" size={20} color={Colors.light.textSecondary} />
            </Pressable>
          </View>
        </BlurView>
      </View>

      {postcards.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="mail-open-outline" size={40} color={Colors.light.textMuted} />
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
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset + 100 }]}
          showsVerticalScrollIndicator={false}
          onRefresh={refresh}
          refreshing={isLoading}
        />
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
        <View style={styles.fabInner}>
          <Ionicons name="scan" size={24} color="#FFFFFF" />
        </View>
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
    shadowColor: Colors.light.slate900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.slate900,
    alignItems: "center",
    justifyContent: "center",
  },
});
