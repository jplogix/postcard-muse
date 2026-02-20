# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Postcard Muse is a mobile application that serves as a digital gallery for physical postcards. Users photograph their postcards (front and back), and the app uses Google Gemini AI to extract handwritten text, detect language, translate the message, and provide text-to-speech playback.

**Tech Stack:** Expo SDK 54 + React Native frontend, Express.js backend, TypeScript

## Common Commands

### Development
```bash
# Start Expo dev server (Replit environment)
npm run expo:dev

# Start Express backend server
npm run server:dev

# Standard Expo start
npm start

# Linting
npm run lint
npm run lint:fix
```

### Database
```bash
# Push schema changes to PostgreSQL
npm run db:push
```

### Production Build
```bash
# Build static Expo bundle
npm run expo:start:static:build
npm run expo:static:build

# Build Express server
npm run server:build

# Run production server
npm run server:prod
```

## Architecture

### Frontend (Expo / React Native)

**Routing:** File-based with Expo Router. Routes in `app/`:
- `index.tsx` - Main gallery screen (postcard grid)
- `add.tsx` - Camera/upload flow for new postcards
- `detail/[id].tsx` - Postcard view with TTS playback
- `settings.tsx` - User preferences (language, address exclusion, BGM)
- `_layout.tsx` - Root layout with providers

**State Management:** React Context (`lib/PostcardContext.tsx`) wraps the app and manages:
- Postcard collection (CRUD operations)
- User settings (target language, exclude address, background music)
- Data persistence via AsyncStorage

**Storage:**
- Metadata: AsyncStorage (`lib/storage.ts`)
- Images: Expo FileSystem in `documentDirectory/postcards/`
- Sample postcards bundled via `Asset.fromModule()` in `assets/samples/`

**Key Providers (in `_layout.tsx` order):**
1. `ErrorBoundary` - Catches render errors
2. `QueryClientProvider` - TanStack Query for API calls
3. `GestureHandlerRootView` - React Native Gesture Handler
4. `KeyboardProvider` - Keyboard controller
5. `PostcardProvider` - App state context

### Backend (Express)

**Entry point:** `server/index.ts`

**API routes** (`server/routes.ts`):
- `POST /api/process-postcard` - AI text extraction via Gemini 2.5 Flash
- `POST /api/tts` - ElevenLabs TTS generation with word-level alignment
- `GET /api/tts-audio/:id` - Serve cached TTS audio
- `GET /api/bgm-piano` - Background music file
- `POST /api/perspective-crop` - Server-side perspective correction

**AI Integration:**
- Google Gemini via `@google/genai` using Replit AI Integrations
- ElevenLabs TTS via `@elevenlabs/elevenlabs-js`
- Sharp for image processing

**TTS Caching:** Audio cached in `/tmp/tts-cache/` with hash-based keys. Alignment data stored alongside as `.json`.

### Shared Code

**Path aliases** (`tsconfig.json`):
- `@/*` → Project root
- `@shared/*` → `./shared/*`

**Database schema** (`shared/schema.ts`): Drizzle ORM with PostgreSQL. Currently defines `users` table (not actively used by frontend).

## Key Components

### UI Components
- `FlipCard` - 3D flip animation with perspective transform
- `AnimatedText` - Word-by-word text reveal synced to TTS
- `HandwritingAnimator` - Character-by-character "writing" animation with spring physics
- `ScanningAnimation` - Particle effects during AI processing (24 particles: indigo, purple, pink, cyan)
- `PostcardThumbnail` - Gallery grid item with glassmorphism styling
- `MeshGradientBackground` - Animated gradient blobs (purple, indigo, pink)

### Core Logic
- `lib/storage.ts` - Postcard CRUD, image persistence, settings management
- `lib/PostcardContext.tsx` - Global state provider
- `lib/samplePostcards.ts` - Pre-packaged demo postcards

## Color Palette (Light Glassmorphism)

```javascript
Background: #FAFAFA
Glass: rgba(255,255,255,0.65)
Accent (indigo): #4F46E5
Secondary (pink): #EC4899
Text: #0F172A (primary), #64748B (secondary), #94A3B8 (muted)
Particles: #818CF8, #A78BFA, #F472B6, #22D3EE
```

## Important Patterns

### Image Handling
1. Images captured/uploaded go through `ImageCropper` (rectangular or perspective mode)
2. Saved permanently via `saveImagePermanently()` to `documentDirectory/postcards/`
3. Sample images use `Asset.fromModule()` and convert to base64 for API

### TTS Sync
- ElevenLabs `/with-timestamps` endpoint returns character-level alignment
- Aggregated into word-level `{word, startMs, endMs}` objects in `server/routes.ts`
- Cached for replay; falls back to syllable-based estimation if unavailable
- Detail screen sync loop uses real timestamps for highlighting

### Navigation
- `router.push()` for navigation
- Safe fallback: `router.replace("/")` when `router.back()` may fail (e.g., after delete)

### Platform Differences
- Web: Uses blob URLs for images, no FileSystem
- Native: Uses Expo FileSystem for permanent storage

## Environment Variables

Required for backend:
- `DATABASE_URL` - PostgreSQL connection
- `AI_INTEGRATIONS_GEMINI_API_KEY` - Gemini API (Replit integration)
- `AI_INTEGRATIONS_GEMINI_BASE_URL` - Gemini base URL (Replit integration)
- `ELEVENLABS_API_KEY` - ElevenLabs TTS

## User Preferences

- **Language:** Simple, everyday language preferred
- **Scanning animation:** "Static" particles similar to Google Lens/Amazon Firefly
- **Audio-text sync:** Should be as tight as possible
