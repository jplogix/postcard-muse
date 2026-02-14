import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { PostcardProvider } from "@/lib/PostcardContext";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const fontAssets: Record<string, any> = {
  Inter_300Light: require("@expo-google-fonts/inter/300Light/Inter_300Light.ttf"),
  Inter_400Regular: require("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"),
  Inter_500Medium: require("@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf"),
  Inter_600SemiBold: require("@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf"),
  Caveat_400Regular: require("@expo-google-fonts/caveat/400Regular/Caveat_400Regular.ttf"),
  Caveat_500Medium: require("@expo-google-fonts/caveat/500Medium/Caveat_500Medium.ttf"),
};

async function loadFontsWeb() {
  const entries = Object.entries(fontAssets);
  const promises = entries.map(async ([name, asset]) => {
    try {
      const src = typeof asset === "number" ? asset : asset.uri || asset.default || asset;
      const url = typeof src === "string" ? src : "";
      if (!url) return;
      const face = new FontFace(name, `url(${url})`);
      const loaded = await face.load();
      (document as any).fonts.add(loaded);
    } catch {}
  });
  await Promise.allSettled(promises);
}

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

function RootLayoutWeb() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadFontsWeb().finally(() => {
      setReady(true);
      SplashScreen.hideAsync();
    });
  }, []);

  if (!ready) return null;

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

function RootLayoutNative() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

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

export default function RootLayout() {
  if (Platform.OS === "web") return <RootLayoutWeb />;
  return <RootLayoutNative />;
}
