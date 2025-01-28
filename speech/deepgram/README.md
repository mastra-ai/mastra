# @mastra/speech-deepgram

Deepgram Speech integration for Mastra, providing Text-to-Speech (TTS) capabilities using Deepgram's advanced AI models.

## Installation

```bash
npm install @mastra/speech-deepgram
```

## Configuration

The module requires the following environment variable:

```bash
DEEPGRAM_API_KEY=your_api_key
```

## Usage

```typescript
import { DeepgramTTS } from '@mastra/speech-deepgram';

// Initialize with configuration
const tts = new DeepgramTTS({
  model: {
    name: 'aura-asteria-en', // Default voice
    apiKey: 'your-api-key', // Optional, can use DEEPGRAM_API_KEY env var
  },
});

// List available voices
const voices = await tts.voices();

// Generate speech
const result = await tts.generate({
  voice: 'aura-asteria-en',
  text: 'Hello from Mastra!',
});

// Stream speech
const stream = await tts.stream({
  voice: 'aura-asteria-en',
  text: 'Hello from Mastra!',
});
```

## Features

- High-quality Text-to-Speech synthesis
- Multiple voice options
- Streaming support
- Natural-sounding voice synthesis
- Low latency generation
- Multiple output formats

## Voice Options

Deepgram provides several AI voices with different characteristics:

- aura-asteria-en (Female, American)
- aura-athena-en (Female, American)
- aura-zeus-en (Male, American)
- aura-hera-en (Female, American)
- aura-orion-en (Male, American)

View the complete list in the `voices.ts` file or [Deepgram's documentation](https://developers.deepgram.com/docs/text-to-speech).
