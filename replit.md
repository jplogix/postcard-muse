# Postcard Muse

## Overview

Postcard Muse is a mobile application that serves as a digital gallery for physical postcards. Users photograph their postcards (front and back), and the app uses Google Gemini AI to extract handwritten text, detect the language, translate the message, and provide text-to-speech playback. The app features a light glassmorphism UI with animated mesh gradient backgrounds, 3D flip card animations, particle scanning effects, and synchronized animated text highlighting during speech playback.

The project is a full-stack Expo + Express application. The Expo frontend handles the mobile UI and local data persistence, while the Express backend proxies AI requests to Google Gemini for postcard processing.

## Recent Changes (Feb 14, 2026)

- Redesigned entire app from dark theme to light glassmorphism aesthetic matching web version
- Added animated MeshGradientBackground with three floating blobs (purple, indigo, pink)
- Replaced Playfair Display + Dancing Script fonts with Inter (UI) + Caveat (handwriting)
- Updated all screens with glass panels (white blur), light borders, and soft shadows
- Color palette: slate grays for text, indigo (#4F46E5) primary, pink (#EC4899) secondary
- BlurView glass header on Gallery screen, paper-textured postcard backs
- StatusBar set to "dark" for light background visibility
- Updated particle colors in scanning animation to indigo/purple/pink/cyan
- Loading jokes now show relevant emojis above each joke, fixed-height container (90px) to prevent layout shift
- TTS audio now has larger breathing pauses at punctuation (500ms at periods, 280ms at commas, 0.5s sentence silence)
- Word timings are syllable-proportional with punctuation-aware pause allocation for tighter audio-text sync
- After playback finishes, a gradient overlay (transparent→white) slowly fades in (800ms) over the text with a centered "Replay" button
- Replay hides backdrop+button immediately (200ms), then audio and text animation restart
- Small speaker/mute button appears in top-right of text container only during audio playback
- Exclude-address toggle in Settings; AI prompt conditionally skips mailing addresses
- Redesigned add screen with dedicated Camera and Upload buttons for each image slot, showing postcard frame guide with 16:10 aspect ratio
- Both camera and upload support native crop editing; selected images show retake chips (camera/upload icons) at bottom-right corner
- AnimatedText uses x-axis (horizontal) fade-in animation, no vertical movement; earlier words fade as lag increases (3+, 5+, 8+ words back)
- After-pause words use softer spring (damping 18, stiffness 80, mass 1.1) with 80ms delay for more natural pacing

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
- **UI**: expo-image, expo-linear-gradient, expo-blur for light glassmorphism. React Native Reanimated for 3D flip and particle animations. expo-haptics for tactile feedback
- **Fonts**: Inter (UI text: 300Light, 400Regular, 500Medium, 600SemiBold), Caveat (handwriting: 400Regular, 500Medium) via expo-font
- **Background**: MeshGradientBackground component with three animated blobs (blobPurple, blobIndigo, blobPink)
- **TTS**: expo-audio for ElevenLabs TTS audio playback. Word-level timing estimation for synchronized text animation
- **Scanning Animation**: Custom particle system with 24 animated particles (indigo, purple, pink, cyan) using Reanimated shared values

### Backend (Express Server)

- **Runtime**: Express 5 on Node.js with TypeScript
- **Main Endpoint**: `POST /api/process-postcard` - accepts base64 images, returns extracted text, translation, description, and word array
- **TTS Endpoint**: `POST /api/tts` - generates speech using ElevenLabs API (Charlotte voice, multilingual v2 model). Returns `{audioUrl, durationMs, wordTimings}`. Audio served via `GET /api/tts-audio/:id`
- **TTS Engine**: ElevenLabs cloud TTS via `@elevenlabs/elevenlabs-js` SDK. MP3 output (44100Hz, 128kbps). Audio cached to disk at `/tmp/tts-cache/`
- **AI**: `@google/genai` SDK via Replit AI Integrations (Gemini 2.5 Flash) for postcard text extraction. No API key needed - billed to Replit credits
- **Body Limit**: 50mb for base64 image payloads
- **CORS**: Dynamic setup for Replit domains and localhost

### Key Components

- `components/ScanningAnimation.tsx` - Particle scanning effect during AI processing
- `components/FlipCard.tsx` - 3D flip animation with perspective transform
- `components/AnimatedText.tsx` - Word-by-word text reveal synced with TTS
- `components/HandwritingAnimator.tsx` - Staggered character-by-character writing animation (spring physics: damping 12, stiffness 100, 50ms stagger)
- `components/LoadingJokes.tsx` - Cycling postcard-themed jokes with fade transitions during AI processing
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
- `audioPath`: (optional) Relative URL path to pre-generated TTS audio
- `audioDurationMs`: (optional) Duration of pre-generated TTS audio in milliseconds
- `createdAt`: Timestamp

### Color Palette

Light glassmorphism theme:
- Background: #FAFAFA
- Glass: rgba(255,255,255,0.65) with white blur
- Glass Card: rgba(255,255,255,0.4)
- Text: Slate grays (#0F172A, #64748B, #94A3B8)
- Accent (indigo): #4F46E5
- Secondary (pink): #EC4899
- Particles: indigo (#818CF8), purple (#A78BFA), pink (#F472B6), cyan (#22D3EE)
- Paper texture: #FDFBF7 for postcard backs
- Blobs: purple (rgba(216,180,254,0.30)), indigo (rgba(199,210,254,0.30)), pink (rgba(251,207,232,0.30))
