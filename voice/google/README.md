# @mastra/speech-google

Google Cloud Speech integration for Mastra, providing Text-to-Speech (TTS) capabilities using Google Cloud's Neural Voice technology.

## Installation

```bash
npm install @mastra/speech-google
```

## Configuration

The module requires the following environment variable:

```bash
GOOGLE_API_KEY=your_api_key
```

## Usage

```typescript
import { GoogleTTS } from '@mastra/speech-google';

// Initialize with configuration
const tts = new GoogleTTS({
  model: {
    name: 'en-US-Standard-C', // Default voice
    apiKey: 'your-api-key', // Optional, can use GOOGLE_API_KEY env var
  },
});

// List available voices
const voices = await tts.voices();

// Generate speech
const result = await tts.generate({
  voice: 'en-US-Standard-C',
  text: 'Hello from Mastra!',
});

// Stream speech
const stream = await tts.stream({
  voice: 'en-US-Standard-C',
  text: 'Hello from Mastra!',
});
```

## Features

- Neural Text-to-Speech synthesis
- Multiple voice options across different languages
- Streaming support
- High-quality speech output
- Natural-sounding voice synthesis

## Voice Options

The module provides access to all Google Cloud TTS voices. Some popular English voices include:

- en-US-Standard-A (Female)
- en-US-Standard-B (Male)
- en-US-Standard-C (Female)
- en-US-Standard-D (Male)
- en-US-Standard-E (Female)

View the complete list in the `voices.ts` file or [Google Cloud's documentation](https://cloud.google.com/text-to-speech/docs/voices).
