# @mastra/voice-google-gemini-live

Google Gemini Live API integration for Mastra, providing real-time multimodal voice interactions with advanced capabilities including video input, tool calling, and session management.

## Installation

```bash
npm install @mastra/voice-google-gemini-live
```

## Usage

```typescript
import { GeminiLiveVoice } from '@mastra/voice-google-gemini-live';

const voice = new GeminiLiveVoice({
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'gemini-2.0-flash-live-001',
  speaker: 'Puck',
});

// Connect to the Live API
await voice.connect();

// Listen for responses
voice.on('speaking', ({ audioData }) => {
  // Handle audio response as Int16Array
  playAudio(audioData);
});

// Or subscribe to a concatenated audio stream per response
voice.on('speaker', audioStream => {
  audioStream.pipe(playbackDevice);
});

voice.on('writing', ({ text, role }) => {
  // role: 'user'      → speech-to-text of the caller
  // role: 'assistant' → speech-to-text of the model's spoken reply
  console.log(`${role}: ${text}`);
});

// Native-audio models only: model's internal reasoning
voice.on('thinking', ({ text }) => {
  console.log(`thinking: ${text}`);
});

// Drop queued playback when the user barges in over the model
voice.on('interrupt', ({ type, timestamp }) => {
  console.log(`interrupt by ${type} at ${timestamp}`);
});

// Send text to speech
await voice.speak('Hello from Mastra!');

// Send audio stream
const microphoneStream = getMicrophoneStream();
await voice.send(microphoneStream);

// When done, disconnect
voice.disconnect();
```

## Documentation

- [@mastra/voice-google-gemini-live documentation](https://mastra.ai/integrations/voice/google)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/google-gemini-live-api/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
