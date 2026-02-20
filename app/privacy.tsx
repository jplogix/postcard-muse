import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import MeshGradientBackground from "@/components/MeshGradientBackground";

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <MeshGradientBackground />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (router.canGoBack()) router.back();
            else router.replace("/");
          }}
          hitSlop={12}
        >
          <Ionicons
            name="close"
            size={24}
            color={Colors.light.textSecondary}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomInset + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last Updated</Text>
          <Text style={styles.sectionText}>February 20, 2026</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Introduction</Text>
          <Text style={styles.text}>
            Postcard Muse ("we," "our," or "us") respects your privacy and is
            committed to protecting your personal data. This privacy policy
            explains how we collect, use, and safeguard your information when you
            use our mobile application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Information We Collect</Text>
          <Text style={styles.subheading}>Postcard Images</Text>
          <Text style={styles.text}>
            When you use the app, you may photograph postcards (front and back).
            These images are stored locally on your device and are not transmitted
            to our servers unless you explicitly choose to use AI processing
            features.
          </Text>

          <Text style={styles.subheading}>AI Processing Data</Text>
          <Text style={styles.text}>
            To provide text extraction, translation, and text-to-speech features,
            postcard images are temporarily sent to:
          </Text>
          <Text style={styles.bullet}>• Google Gemini API (for text extraction and translation)</Text>
          <Text style={styles.bullet}>• ElevenLabs API (for text-to-speech generation)</Text>
          <Text style={styles.text}>
            These third-party services process your data according to their own
            privacy policies. We do not store your images or processed text on
            our servers.
          </Text>

          <Text style={styles.subheading}>User Preferences</Text>
          <Text style={styles.text}>
            We store your app preferences locally on your device, including:
          </Text>
          <Text style={styles.bullet}>• Target language for translations</Text>
          <Text style={styles.bullet}>• Background music settings</Text>
          <Text style={styles.bullet}>• Address exclusion preferences</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>How We Use Your Data</Text>
          <Text style={styles.text}>
            Your data is used exclusively for:
          </Text>
          <Text style={styles.bullet}>• Extracting handwritten text from postcard images</Text>
          <Text style={styles.bullet}>• Detecting the language of the message</Text>
          <Text style={styles.bullet}>• Translating text to your preferred language</Text>
          <Text style={styles.bullet}>• Generating audio playback of the message</Text>
          <Text style={styles.bullet}>• Storing your postcard collection locally on your device</Text>
          <Text style={styles.text}>
            We do not sell, rent, or share your data with third parties for
            marketing purposes.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Data Storage & Retention</Text>
          <Text style={styles.text}>
            All postcard images, extracted text, translations, and audio files
            are stored locally on your device. You retain full control over your
            data and can delete individual postcards or clear your entire
            collection at any time through the Settings screen.
          </Text>
          <Text style={styles.text}>
            Generated audio files are temporarily cached on our server for 24
            hours to improve performance, then automatically deleted.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Third-Party Services</Text>
          <Text style={styles.subheading}>Google Gemini</Text>
          <Text style={styles.text}>
            We use Google Gemini to analyze postcard images and extract text.
            Google may process image data according to their{" "}
            <Text style={styles.link}>Google Privacy Policy</Text>.
          </Text>

          <Text style={styles.subheading}>ElevenLabs</Text>
          <Text style={styles.text}>
            We use ElevenLabs to generate text-to-speech audio. Your translated
            text is sent to ElevenLabs for audio generation. See their{" "}
            <Text style={styles.link}>ElevenLabs Privacy Policy</Text> for details.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Data Security</Text>
          <Text style={styles.text}>
            While we strive to protect your data, no method of transmission over
            the internet is 100% secure. We use industry-standard encryption for
            data in transit and implement reasonable security measures to protect
            your information.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Children's Privacy</Text>
          <Text style={styles.text}>
            Our service is not intended for children under 13. We do not
            knowingly collect personal information from children under 13. If you
            are a parent or guardian and believe your child has provided us with
            personal information, please contact us.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Your Rights</Text>
          <Text style={styles.text}>
            You have the right to:
          </Text>
          <Text style={styles.bullet}>• Access all postcards stored on your device</Text>
          <Text style={styles.bullet}>• Delete individual postcards or your entire collection</Text>
          <Text style={styles.bullet}>• Modify your app preferences at any time</Text>
          <Text style={styles.bullet}>• Stop using the app without consequence</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Changes to This Policy</Text>
          <Text style={styles.text}>
            We may update this privacy policy from time to time. We will notify
            you of any changes by posting the new policy on this page and
            updating the "Last Updated" date.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Contact Us</Text>
          <Text style={styles.text}>
            If you have questions about this Privacy Policy or how we handle
            your data, please contact us through the app or via our website.
          </Text>
          <Text style={styles.versionText}>Postcard Muse Version 1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  section: {
    backgroundColor: Colors.light.glassCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.glassBorderCard,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  heading: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  subheading: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 6,
  },
  text: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 21,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  bullet: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 21,
    marginLeft: 16,
    marginBottom: 4,
  },
  link: {
    color: Colors.light.accent,
    fontFamily: "Inter_500Medium",
  },
  versionText: {
    fontSize: 11,
    fontFamily: "Inter_300Light",
    color: Colors.light.textMuted,
    marginTop: 12,
    textAlign: "center",
  },
});
