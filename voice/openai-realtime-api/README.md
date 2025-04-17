# @mastra/voice-openai-realtime

OpenAI Realtime Voice integration for Mastra, providing real-time voice interaction capabilities using OpenAI's WebSocket-based API. This integration enables seamless voice conversations with real-time speech to speech capabilities.

## Installation

```bash
npm install @mastra/voice-openai-realtime
```

## Configuration

The module requires an OpenAI API key, which can be provided through environment variables or directly in the configuration:

```bash
OPENAI_API_KEY=your_api_key
```

## Usage

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { getMicrophoneStream } from '@mastra/node-audio';

// Create a voice instance with default configuration
const voice = new OpenAIRealtimeVoice();

// Create a voice instance with configuration
const voice = new OpenAIRealtimeVoice({
  chatModel: {
    apiKey: 'your-api-key', // Optional, can use OPENAI_API_KEY env var
    model: 'gpt-4o-mini-realtime', // Optional, uses latest model by default
    options: {
      sessionConfig: {
        voice: 'alloy', // Default voice
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          silence_duration_ms: 1000,
        },
      },
    },
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

## Features

- Real-time voice interactions via WebSocket
- Seamless speech to speech
- Voice activity detection (VAD)
- Multiple voice options
- Event-based audio streaming
- Tool integration support

## Voice Options

Available voices include:

- alloy (Neutral)
- ash (Balanced)
- echo (Warm)
- shimmer (Clear)
- coral (Expressive)
- sage (Professional)
- ballad (Melodic)
- verse (Dynamic)

## Events

The voice instance emits several events:

- `speaking`: Emitted while generating speech, provides Int16Array audio data
- `writing`: Emitted when speech is transcribed to text
- `error`: Emitted when an error occurs

You can also listen to OpenAI Realtime [sdk utility events](https://github.com/openai/openai-realtime-api-beta/tree/main?tab=readme-ov-file#reference-client-utility-events) by prefixing with 'openAIRealtime:', such as:

- `openAIRealtime:conversation.item.completed`
- `openAIRealtime:conversation.updated`

## Voice Activity Detection

The realtime voice integration includes server-side VAD (Voice Activity Detection) with configurable parameters:

```typescript
voice.updateConfig({
  voice: 'echo',
  turn_detection: {
    type: 'server_vad',
    threshold: 0.5, // Speech detection sensitivity
    silence_duration_ms: 1000, // Wait time before ending turn
    prefix_padding_ms: 1000, // Audio padding before speech
  },
});
```

## Tool Integration

You can add tools to the voice instance with tools that extend its capabilities:

```typescript
export const menuTool = createTool({
  id: 'menuTool',
  description: 'Get menu items',
  inputSchema: z
    .object({
      query: z.string(),
    })
    .required(),
  execute: async ({ context }) => {
    // Implement menu search functionality
  },
});

voice.addTools(menuTool);
```

## API Reference

For detailed API documentation, refer to the JSDoc comments in the source code or generate documentation using TypeDoc.
