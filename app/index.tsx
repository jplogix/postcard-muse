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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePostcards } from "@/lib/PostcardContext";
import PostcardThumbnail, { CARD_SIZE, GAP } from "@/components/PostcardThumbnail";

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

  const renderItem = ({ item, index }: { item: any; index: number }) => (
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
      <LinearGradient
        colors={[Colors.dark.background, "#12121F", Colors.dark.background]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <View>
          <Text style={styles.brandText}>Postcard</Text>
          <Text style={styles.brandAccent}>Muse</Text>
        </View>
        <Pressable onPress={handleSettings} hitSlop={12}>
          <Feather name="settings" size={22} color={Colors.dark.textSecondary} />
        </Pressable>
      </View>

      {postcards.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="mail-open-outline" size={48} color={Colors.dark.textMuted} />
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
        style={({ pressed }) => [
          styles.fab,
          { bottom: bottomInset + 24 },
          pressed && { transform: [{ scale: 0.92 }] },
        ]}
      >
        <LinearGradient
          colors={[Colors.dark.accent, "#B8862D"]}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="scan" size={26} color="#FFF" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  brandText: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.dark.text,
    lineHeight: 32,
  },
  brandAccent: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_400Regular",
    color: Colors.dark.accent,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  row: {
    paddingHorizontal: 24,
    gap: GAP,
    marginBottom: GAP,
  },
  listContent: {
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_700Bold",
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  fab: {
    position: "absolute",
    right: 24,
    shadowColor: Colors.dark.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});
