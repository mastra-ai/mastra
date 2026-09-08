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
await voice.connect();

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

## Connection failures

`connect()` waits for both the WebSocket to open and the server to create a session. It rejects if the connection fails, the server reports an error during the handshake, or the socket closes before the session is ready. A silent handshake times out after 15,000 milliseconds by default.

Use `connectTimeoutMs` to configure the handshake deadline. The value must be a positive, finite number no greater than 2,147,483,647 milliseconds. Catch connection failures directly; an `error` event listener does not replace handling the rejected promise.

```typescript
const voice = new OpenAIRealtimeVoice({
  apiKey: process.env.OPENAI_API_KEY,
  connectTimeoutMs: 30_000,
});

try {
  await voice.connect();
} catch (error) {
  console.error('Could not connect to the realtime service:', error);
}
```

A failed handshake closes its socket and clears its pending waits. You can retry with `connect()` on the same instance. The deadline only applies to connection setup, not to an established session.

## Documentation

- [@mastra/voice-openai-realtime documentation](https://mastra.ai/integrations/voice/openai)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/openai-realtime-api/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
