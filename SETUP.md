# apply.fy — Setup & Deployment Guide

A Tinder-style iOS job application app with AI-powered auto-fill, LaTeX resume parsing, and swipe-based job discovery.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Configuration (.env)](#configuration)
4. [Running the App](#running-the-app)
5. [Job APIs Setup](#job-apis-setup)
6. [AI Features Setup](#ai-features-setup)
7. [Backend Setup (optional)](#backend-setup)
8. [TestFlight Deployment](#testflight-deployment)
9. [App Store Submission](#app-store-submission)
10. [Architecture](#architecture)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **macOS** (required for iOS builds)
- **Node.js** 18+ (`node --version`)
- **Xcode** 15+ from App Store
- **Apple Developer Account** ($99/year) — for TestFlight/App Store
- **Expo CLI** and **EAS CLI**

```bash
npm install -g expo-cli eas-cli
```

---

## Quick Start

```bash
# 1. Clone and install
cd apply.fy
npm install

# 2. Create your .env file (copy from example)
cp .env.example .env
# Edit .env with your personal information

# 3. Start development
npx expo start --ios
```

---

## Configuration

### Your .env File

Create `.env` in the project root (it's gitignored — never commit this):

```env
# Personal Info
NAME=Jane Doe
EMAIL=jane@example.com
PHONE=+1 555 123 4567
LINKEDIN_URL=https://linkedin.com/in/janedoe
PORTFOLIO_URL=https://janedoe.dev
GITHUB_URL=https://github.com/janedoe

# Resume (path to your .tex file)
RESUME_TEX_PATH=/Users/jane/resume.tex

# Job Preferences
PREFERRED_ROLES=Software Engineer,Full Stack Engineer
PREFERRED_LOCATIONS=San Francisco CA,Remote
SKILLS=TypeScript,React,Node.js,Python,AWS
YEARS_EXPERIENCE=4
SALARY_MIN=140000
SALARY_MAX=220000
REMOTE_PREFERENCE=hybrid   # remote | hybrid | onsite | any

# API Keys
OPENAI_API_KEY=sk-...
JSEARCH_API_KEY=your_rapidapi_key  # from rapidapi.com/letscrape-6bffd33/apis/jsearch

# Optional Backend
BACKEND_URL=http://localhost:3001
```

### How to Import in App

1. Save your `.env` file to your iPhone via AirDrop or iCloud Drive
2. Open apply.fy → **Onboarding → Import Profile** → select the file
3. Your profile is stored securely in iOS Keychain (Secure Store)

---

## Running the App

### Development (Simulator)

```bash
npx expo start --ios
```

### Development (Physical Device)

```bash
# Install Expo Go from App Store, then:
npx expo start
# Scan QR code with your iPhone camera
```

### Development Build (recommended — supports all native features)

```bash
# First time: create development build
eas build --platform ios --profile development
# Install the .ipa on your device, then:
npx expo start --dev-client
```

---

## Job APIs Setup

### Option 1: Demo Mode (No API Keys)
Works immediately with 5 curated demo jobs. Good for testing the UI.

### Option 2: Free APIs (Limited)
- **The Muse API**: 500 req/day free, tech jobs only
- **Remotive**: Unlimited, remote jobs only

These work automatically without API keys.

### Option 3: JSearch API (Recommended — $10/month)
Aggregates **LinkedIn, Indeed, Glassdoor, ZipRecruiter** and more.

1. Go to [rapidapi.com](https://rapidapi.com/letscrape-6bffd33/apis/jsearch)
2. Subscribe to the free tier (100 req/month) or Basic ($10/month)
3. Copy your API key
4. Add to `.env`: `JSEARCH_API_KEY=your_key`
5. Re-import your `.env` in the app

---

## AI Features Setup

apply.fy uses **GPT-4o-mini** (cheapest, fastest GPT-4 class model):

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create account → API Keys → Create new key
3. Add credit ($5 minimum, will last months for personal use)
4. Add to `.env`: `OPENAI_API_KEY=sk-...`

**AI features enabled:**
- ✅ Answer any application question with personalized response
- ✅ Generate tailored cover letters
- ✅ Job match scoring (0-100%)
- ✅ "Why do you want to work here?" auto-generation

**Cost estimate**: ~$0.002 per answer, ~$0.01 per cover letter

---

## Backend Setup (Optional)

The backend is only needed for:
- Compiling LaTeX → PDF on a server
- Advanced job scraping

### Local Development

```bash
cd backend
npm install
cp .env.example .env  # add your keys
npm run dev
# Server runs on http://localhost:3001
```

### Deploy to Railway (recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

# Deploy
cd backend
railway up
# Copy the deployment URL → add to app .env as BACKEND_URL
```

### Deploy to Vercel

```bash
cd backend
npx vercel
# Follow prompts
```

---

## TestFlight Deployment

This deploys your app for beta testing (you and up to 10,000 testers).

### Step 1: Configure EAS

```bash
# Login to Expo/EAS
eas login

# Initialize EAS project
eas build:configure
```

Update `app.json`:
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "your-project-id"  // shown after eas build:configure
      }
    }
  }
}
```

Update `eas.json` with your Apple credentials:
```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@apple.id",
        "ascAppId": "your_app_store_connect_app_id",
        "appleTeamId": "your_team_id"
      }
    }
  }
}
```

### Step 2: Build for TestFlight

```bash
# Build production iOS binary
npm run build:ios
# This takes ~15-20 minutes on EAS cloud
```

### Step 3: Submit to TestFlight

```bash
npm run submit:ios
```

### Step 4: Configure TestFlight
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. My Apps → your app → TestFlight tab
3. Add internal/external testers
4. Testers get email to install via TestFlight app

---

## App Store Submission

### Requirements Checklist

- [ ] App icon (1024×1024 PNG) — place in `assets/icon.png`
- [ ] Screenshots (6.5" and 5.5" iPhone) — add in App Store Connect
- [ ] App description and keywords
- [ ] Privacy policy URL (required if collecting any data)
- [ ] Age rating questionnaire answered

### Prepare Assets

```bash
# Generate all icon sizes automatically
npx expo install expo-asset
# Place your 1024x1024 icon at assets/icon.png
# Place your splash screen at assets/splash.png (1242x2436)
```

### Build & Submit

```bash
# Build production binary
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

### App Store Review
- Typical review time: 1-3 days
- First submission often has questions — check App Store Connect

### Privacy Policy (Required)

Since the app stores personal data, you need a privacy policy. Use a simple hosting service like GitHub Pages:

```markdown
# apply.fy Privacy Policy

All data is stored locally on your device. We do not collect, transmit,
or store any personal information on external servers.

API keys you provide are stored in iOS Keychain and used only to make
requests to third-party services (OpenAI, RapidAPI) on your behalf.

Contact: your@email.com
```

---

## Architecture

```
apply.fy/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout + gesture handler
│   ├── index.tsx           # Auth gate (onboarding or main)
│   ├── onboarding/         # 3-step onboarding flow
│   │   ├── index.tsx       # Welcome screen
│   │   ├── profile.tsx     # Import .env file
│   │   ├── resume.tsx      # Upload .tex resume
│   │   └── preferences.tsx # Job preferences
│   └── (tabs)/             # Main app (tab navigator)
│       ├── index.tsx       # Swipe screen (main)
│       ├── saved.tsx       # Bookmarked jobs
│       ├── applied.tsx     # Application tracker
│       └── profile.tsx     # User profile
│
├── components/
│   ├── SwipeCard.tsx       # Individual job card w/ gesture
│   ├── SwipeStack.tsx      # Stack of 3 cards + empty state
│   ├── JobDetailModal.tsx  # Full job details + AI Q&A
│   └── ActionButtons.tsx   # Skip/Apply/Save buttons
│
├── lib/
│   ├── database.ts         # expo-sqlite CRUD
│   ├── resumeParser.ts     # LaTeX → JSON parser
│   ├── aiAssistant.ts      # OpenAI GPT-4o-mini
│   ├── jobService.ts       # JSearch + Muse + Remotive APIs
│   └── userProfile.ts      # .env parser + SecureStore
│
├── store/
│   └── appStore.ts         # Zustand + AsyncStorage persistence
│
├── types/index.ts          # TypeScript types
├── constants/colors.ts     # Design tokens (dark theme)
│
└── backend/                # Optional Node.js service
    └── src/
        ├── server.ts       # Express app
        └── routes/
            ├── jobs.ts     # Job scraping proxy
            ├── ai.ts       # OpenAI proxy
            └── latex.ts    # LaTeX → PDF compiler
```

### Data Flow

```
.env file → parseEnvFile() → UserProfile → SecureStore
.tex file → parseLatexResume() → ResumeData → Zustand store
  ↓
Preferences → jobService.fetchJobs() → Jobs[] → SQLite + Zustand
  ↓
SwipeStack → Swipe gesture → swipeRight/Left/Up actions
  ↓
swipeRight → WebBrowser.openBrowserAsync(applyUrl) + record in store
  ↓
JobDetailModal → aiAssistant.answerApplicationQuestion() → GPT-4o-mini
```

---

## Troubleshooting

### "Module not found: react-native-gesture-handler"

```bash
npm install react-native-gesture-handler
npx expo install react-native-gesture-handler
```

### iOS Simulator shows blank screen

Make sure `babel.config.js` includes the reanimated plugin:
```js
plugins: ['react-native-reanimated/plugin']
```

### Jobs not loading

1. Check API keys are correctly imported from `.env`
2. Try demo mode first (no API keys needed)
3. Check network connection
4. Look at console logs in Expo DevTools

### SwipeCard not responding to gestures

Ensure `GestureHandlerRootView` wraps the root component (it's in `app/_layout.tsx`).

### EAS build fails: "No Apple Developer team"

```bash
eas credentials  # Set up certificates manually
# Or use automatic signing in eas.json
```

### pdflatex not found (backend)

```bash
# macOS
brew install --cask mactex

# Ubuntu/Debian
sudo apt install texlive-full

# Check installation
pdflatex --version
```

---

## Development Tips

- **Fast Refresh**: Changes to React components hot-reload automatically
- **Debug Tools**: Shake device → Show developer menu → JS debugger
- **SQLite Browser**: Use [DB Browser for SQLite](https://sqlitebrowser.org/) to inspect the local database
- **API testing**: The backend has a `/health` endpoint at `http://localhost:3001/health`

---

*Built with React Native + Expo SDK 52, designed for iOS 16+*
