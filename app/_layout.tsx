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
        contentStyle: { backgroundColor: Colors.light.background },
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
            Inter_300Light: require("@expo-google-fonts/inter/300Light/Inter_300Light.ttf"),
            Inter_400Regular: require("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"),
            Inter_500Medium: require("@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf"),
            Inter_600SemiBold: require("@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf"),
            Caveat_400Regular: require("@expo-google-fonts/caveat/400Regular/Caveat_400Regular.ttf"),
            Caveat_500Medium: require("@expo-google-fonts/caveat/500Medium/Caveat_500Medium.ttf"),
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
              <StatusBar style="dark" />
              <RootLayoutNav />
            </PostcardProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
