import * as Font from "expo-font";

export async function loadFonts(): Promise<void> {
  await Font.loadAsync({
    Inter_300Light: require("@expo-google-fonts/inter/300Light/Inter_300Light.ttf"),
    Inter_400Regular: require("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"),
    Inter_500Medium: require("@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf"),
    Inter_600SemiBold: require("@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf"),
    Caveat_400Regular: require("@expo-google-fonts/caveat/400Regular/Caveat_400Regular.ttf"),
    Caveat_500Medium: require("@expo-google-fonts/caveat/500Medium/Caveat_500Medium.ttf"),
  });
}
