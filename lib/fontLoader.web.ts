const fontAssets: Record<string, string> = {
  Inter_300Light: require("@expo-google-fonts/inter/300Light/Inter_300Light.ttf"),
  Inter_400Regular: require("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"),
  Inter_500Medium: require("@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf"),
  Inter_600SemiBold: require("@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf"),
  Caveat_400Regular: require("@expo-google-fonts/caveat/400Regular/Caveat_400Regular.ttf"),
  Caveat_500Medium: require("@expo-google-fonts/caveat/500Medium/Caveat_500Medium.ttf"),
};

async function loadFontWithTimeout(name: string, src: string, timeoutMs = 3000) {
  try {
    const url = typeof src === "string" ? src : "";
    if (!url) return;
    const face = new FontFace(name, `url(${url})`);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Font load timeout")), timeoutMs);
    });
    const loaded = await Promise.race([face.load(), timeoutPromise]);
    (document.fonts as any).add(loaded);
  } catch {}
}

export async function loadFonts(): Promise<void> {
  const promises = Object.entries(fontAssets).map(([name, src]) =>
    loadFontWithTimeout(name, src, 3000)
  );
  await Promise.allSettled(promises);
}
