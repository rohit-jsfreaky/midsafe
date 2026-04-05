# 🧘 MindSafe — Private AI Mental Wellness Companion

> Your mind. Your device. Your rules.

MindSafe is a fully offline mental wellness app powered by Google's Gemma 4
AI model running entirely on your phone via llama.cpp. Zero data leaves your
device. Ever.

## Features

- **AI Companion** — Compassionate conversations with streaming responses
- **Mood Tracker** — Daily emoji-based mood logging with weekly charts
- **Private Journal** — Write reflections, get AI insights after saving
- **Insights Dashboard** — Mood trends, positive factor correlations, weekly AI reflections
- **100% Offline** — Works in airplane mode after one-time model download
- **Encrypted** — All data AES-256 encrypted on device

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native CLI 0.84 (New Architecture) |
| AI Inference | llama.rn (llama.cpp bindings) |
| AI Model | Google Gemma 4 E2B Q3_K_M (2.5GB GGUF) |
| Database | op-sqlite (SQLite) |
| Encryption | AES-256 via react-native-aes-crypto |
| State | Zustand |
| Navigation | React Navigation (Material Top Tabs — swipeable) |

## Privacy

- No analytics, no crash reporting, no telemetry
- No accounts required
- All AI inference on-device
- AES-256 encrypted storage
- Works offline after model download

## Screenshots

[Add your screenshots here]

## Getting Started

### Prerequisites
- Node.js 18+
- JDK 17
- Android Studio with SDK & NDK

### Install & Run
\`\`\`bash
git clone https://github.com/yourusername/mindsafe.git
cd mindsafe
npm install
npx react-native run-android
\`\`\`

## License

MIT

## Disclaimer

MindSafe is a wellness companion, not a replacement for professional therapy.
If you're in crisis, please contact a local helpline.