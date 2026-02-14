# Postcard Muse

## Overview

Postcard Muse is a mobile application that serves as a digital gallery for physical postcards. Users photograph their postcards (front and back), and the app uses Google Gemini AI to extract handwritten text, detect the language, translate the message, and provide text-to-speech playback. The app features a premium dark UI with 3D flip card animations, particle scanning effects, and synchronized animated text highlighting during speech playback.

The project is a full-stack Expo + Express application. The Expo frontend handles the mobile UI and local data persistence, while the Express backend proxies AI requests to Google Gemini for postcard processing.

## Recent Changes (Feb 14, 2026)

- Initial build of Postcard Muse app
- Gallery home screen with grid layout and FAB
- Add postcard flow with image picker and scanning animation with particle effects
- AI-powered text extraction and translation via Gemini backend endpoint
- 3D flip card animation on detail view
- Synchronized word-by-word text animation with TTS audio playback
- Settings screen with target language selection
- Custom fonts: Playfair Display (branding), Dancing Script (handwriting)

## User Preferences

Preferred communication style: Simple, everyday language.
User wants modern scanning animation with "static" particles similar to Google Lens/Amazon Firefly.
User wants handwritten text animation and audio to be in sync as much as possible.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with Expo Router (file-based routing) and TypeScript
- **Navigation**: Expo Router with a Stack navigator. Routes: home gallery (`index`), add postcard (`add`), postcard detail (`detail/[id]`), settings (`settings`)
- **State Management**: React Context (`PostcardContext`) manages postcard collection and user settings
- **Local Storage**: AsyncStorage for postcard metadata, Expo FileSystem for permanent image storage
- **UI**: expo-image, expo-linear-gradient, expo-blur for dark theme. React Native Reanimated for 3D flip and particle animations. expo-haptics for tactile feedback
- **Fonts**: Playfair Display (branding), Dancing Script (handwriting) via expo-font with ttf file requires
- **TTS**: expo-speech with word-level timing estimation for synchronized text animation
- **Scanning Animation**: Custom particle system with 24 animated particles (gold, amber, indigo, cyan) using Reanimated shared values

### Backend (Express Server)

- **Runtime**: Express 5 on Node.js with TypeScript
- **Main Endpoint**: `POST /api/process-postcard` - accepts base64 images, returns extracted text, translation, description, and word array
- **AI**: `@google/genai` SDK via Replit AI Integrations (Gemini 2.5 Flash). No API key needed - billed to Replit credits
- **Body Limit**: 50mb for base64 image payloads
- **CORS**: Dynamic setup for Replit domains and localhost

### Key Components

- `components/ScanningAnimation.tsx` - Particle scanning effect during AI processing
- `components/FlipCard.tsx` - 3D flip animation with perspective transform
- `components/AnimatedText.tsx` - Word-by-word text reveal synced with TTS
- `components/PostcardThumbnail.tsx` - Gallery grid item with gradient overlay
- `lib/PostcardContext.tsx` - React context for postcard state management
- `lib/storage.ts` - AsyncStorage and FileSystem operations

### Data Model

**Client-side Postcard** (AsyncStorage JSON):
- `id`: UUID string (expo-crypto)
- `frontImageUri` / `backImageUri`: Local file paths
- `originalText`: Extracted text from postcard
- `translatedText`: Translation in target language
- `detectedLanguage`: Source language detected by AI
- `targetLanguage`: User's chosen translation language
- `description`: AI-generated visual description
- `words`: Array of individual translated words (for animated TTS highlighting)
- `createdAt`: Timestamp

### Color Palette

Dark theme with indigo/amber tones:
- Background: #0F0F1A
- Surface: #1A1A2E
- Accent (gold): #D4A053
- Indigo: #6366F1
- Particles: gold (#FFD700), amber (#F59E0B), indigo (#818CF8), cyan (#22D3EE)
