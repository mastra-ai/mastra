# @mastra/speech-elevenlabs

ElevenLabs Speech integration for Mastra, providing Text-to-Speech (TTS) capabilities using ElevenLabs' advanced AI voice technology.

## Installation

```bash
npm install @mastra/speech-elevenlabs
```

## Configuration

The module requires the following environment variable:

```bash
ELEVENLABS_API_KEY=your_api_key
```

## Usage

```typescript
import { ElevenLabsTTS } from '@mastra/speech-elevenlabs';

// Initialize with configuration
const tts = new ElevenLabsTTS({
  model: {
    name: 'Adam', // Default voice
    apiKey: 'your-api-key', // Optional, can use ELEVENLABS_API_KEY env var
  },
});

// List available voices
const voices = await tts.voices();

// Generate speech
const result = await tts.generate({
  voice: 'Adam',
  text: 'Hello from Mastra!',
});

// Stream speech
const stream = await tts.stream({
  voice: 'Adam',
  text: 'Hello from Mastra!',
});
```

## Features

- High-fidelity Text-to-Speech synthesis
- Multiple premium voice options
- Streaming support
- Highly natural and expressive speech
- Voice cloning capabilities (with appropriate subscription)

## Voice Options

ElevenLabs provides a variety of premium voices with different characteristics:

- Adam (Male)
- Antoni (Male)
- Arnold (Male)
- Bella (Female)
- Dorothy (Female)
- Elli (Female)
- Josh (Male)
- Rachel (Female)
- Sam (Male)

View the complete list in the `voices.ts` file or [ElevenLabs' documentation](https://docs.elevenlabs.io/api-reference/voices).
