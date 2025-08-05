# @mastra/voice-google-gemini-live

Google Gemini Live API integration for Mastra, providing real-time multimodal voice interactions with advanced capabilities including video input, tool calling, and session management.

## Installation

```bash
npm install @mastra/voice-google-gemini-live
```

## Configuration

The module requires one of the following environment variables:

```bash
# For Google Gemini API
GOOGLE_API_KEY=your_api_key

# OR for Vertex AI (recommended for production)
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
GOOGLE_CLOUD_PROJECT=your_project_id
```

## Usage

```typescript
import { GeminiLiveVoice } from '@mastra/voice-google-gemini-live';

// Initialize with Gemini API
const voice = new GeminiLiveVoice({
  apiKey: 'your-api-key', // Optional, can use GOOGLE_API_KEY env var
  model: 'gemini-2.0-flash-live-001',
  speaker: 'Puck', // Default voice
});

// OR initialize with Vertex AI (recommended for production)
const voice = new GeminiLiveVoice({
  vertexAI: true,
  project: 'your-project-id',
  model: 'gemini-2.0-flash-live-001',
  speaker: 'Puck',
});

// Connect to the Live API
await voice.connect();

// Listen for responses
voice.on('speaking', ({ audio }) => {
  // Handle audio response (Int16Array)
  playAudio(audio);
});

voice.on('writing', ({ text, role }) => {
  // Handle transcribed text
  console.log(`${role}: ${text}`);
});

// Send text to speech
await voice.speak('Hello from Mastra!');

// Send audio stream
const microphoneStream = getMicrophoneStream();
await voice.send(microphoneStream);

// When done, disconnect
voice.disconnect();
```

## Features

- **Real-time bidirectional audio streaming**
- **Multimodal input support** (audio, video, text)
- **Built-in Voice Activity Detection (VAD)**
- **Interrupt handling** - Natural conversation flow
- **Session management** - Resume conversations after network interruptions
- **Tool calling support** - Integrate with external APIs and functions
- **Live transcription** - Real-time speech-to-text
- **Multiple voice options** - Choose from various voice personalities
- **Multilingual support** - Support for 30+ languages

## Advanced Features

### Video Input
```typescript
// Send video frames alongside audio
const videoStream = getCameraStream();
await voice.sendVideo(videoStream);
```

### Tool Calling
```typescript
const voice = new GeminiLiveVoice({
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        }
      }
    }
  ]
});
```

### Session Management
```typescript
// Enable session resumption
const voice = new GeminiLiveVoice({
  sessionConfig: {
    enableResumption: true,
    maxDuration: '24h'
  }
});

// Resume a previous session
await voice.resumeSession(sessionHandle);
```

## Voice Options

- **Puck** - Conversational, friendly
- **Charon** - Deep, authoritative  
- **Kore** - Neutral, professional
- **Fenrir** - Warm, approachable

## Model Options

- `gemini-2.0-flash-live-001` - Latest production model
- `gemini-2.5-flash-preview-native-audio-dialog` - Preview with native audio
- `gemini-live-2.5-flash-preview` - Half-cascade architecture

For detailed API documentation, visit [Google's Gemini Live API docs](https://ai.google.dev/gemini-api/docs/live).