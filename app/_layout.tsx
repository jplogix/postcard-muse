import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { PostcardProvider } from "@/lib/PostcardContext";
import * as Font from "expo-font";
import { StatusBar } from "expo-status-bar";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.dark.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="add"
        options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen name="detail/[id]" />
      <Stack.Screen
        name="settings"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Promise.race([
          Font.loadAsync({
            PlayfairDisplay_700Bold: require("@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf"),
            PlayfairDisplay_400Regular: require("@expo-google-fonts/playfair-display/400Regular/PlayfairDisplay_400Regular.ttf"),
            DancingScript_400Regular: require("@expo-google-fonts/dancing-script/400Regular/DancingScript_400Regular.ttf"),
            DancingScript_700Bold: require("@expo-google-fonts/dancing-script/700Bold/DancingScript_700Bold.ttf"),
          }),
          new Promise((resolve) => setTimeout(resolve, 4000)),
        ]);
      } catch (e) {
        console.warn("Font loading failed, using system fonts:", e);
      } finally {
        setAppReady(true);
        SplashScreen.hideAsync();
      }
    }
    loadFonts();
  }, []);

  if (!appReady) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <PostcardProvider>
              <StatusBar style="light" />
              <RootLayoutNav />
            </PostcardProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
