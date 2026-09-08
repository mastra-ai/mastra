# @mastra/voice-playai

PlayAI Voice integration for Mastra, providing Text-to-Speech (TTS) capabilities using PlayAI's voice synthesis technology.

## Installation

```bash
npm install @mastra/voice-playai
```

## Usage

```typescript
import { PlayAIVoice } from '@mastra/voice-playai';

// Initialize with configuration
const voice = new PlayAIVoice({
  speechModel: {
    name: 'PlayDialog', // Optional, defaults to 'PlayDialog'
    apiKey: 'your-api-key', // Optional, can use PLAYAI_API_KEY env var
    userId: 'your-user-id', // Optional, can use PLAYAI_USER_ID env var
  },
  speaker: 's3://voice-cloning-zero-shot/baf1ef41-36b6-428c-9bdf-50ba54682bd8/original/manifest.json', // Optional, defaults to first available voice
});

// Or use with defaults (using env vars)
const defaultVoice = new PlayAIVoice();

// List available speakers
const speakers = await voice.getSpeakers();

// Generate speech from text
const stream = await voice.speak('Hello from Mastra!');

// Or generate speech from a text stream
const textStream = getTextStream(); // Your text stream source
const audioStream = await voice.speak(textStream);

// The stream can be piped to a destination
stream.pipe(destination);
```

## Documentation

- [`voice.speak()` reference](https://mastra.ai/reference/voice/voice.speak)
- [`voice.listen()` reference](https://mastra.ai/reference/voice/voice.listen)
- [`CompositeVoice` with PlayAI](https://mastra.ai/reference/voice/composite-voice)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/playai/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
