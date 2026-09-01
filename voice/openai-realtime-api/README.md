# @mastra/voice-openai-realtime

OpenAI Realtime Voice integration for Mastra, providing real-time voice interaction capabilities using OpenAI's WebSocket-based API. This integration enables seamless voice conversations with real-time speech to speech capabilities.

## Installation

```bash
npm install @mastra/voice-openai-realtime
```

## Usage

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { getMicrophoneStream } from '@mastra/node-audio';

const voice = new OpenAIRealtimeVoice({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini-realtime',
});

voice.updateSession({
  turn_detection: {
    type: 'server_vad',
    threshold: 0.5,
    silence_duration_ms: 1000,
  },
});

// Connect to the realtime service
await voice.open();

// Audio data from voice provider
voice.on('speaking', (audioData: Int16Array) => {
  // Handle audio data
});

// Text data from voice provider
voice.on('writing', (text: string) => {
  // Handle transcribed text
});

// Error from voice provider
voice.on('error', (error: Error) => {
  console.error('Voice error:', error);
});

// Generate speech
await voice.speak('Hello from Mastra!', {
  speaker: 'echo', // Optional: override default speaker
});

// Listen to audio input
await voice.listen(audioData);

// Process audio input
const microphoneStream = getMicrophoneStream();
await voice.send(microphoneStream);

// Clean up
voice.close();
```

## Documentation

- [@mastra/voice-openai-realtime documentation](https://mastra.ai/integrations/voice/openai)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/openai-realtime-api/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
