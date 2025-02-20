# @mastra/speech-murf

Murf Speech integration for Mastra, providing Text-to-Speech (TTS) capabilities using Murf's AI voice technology.

## Installation

```bash
npm install @mastra/speech-murf
```

## Configuration

The module requires the following environment variable:

```bash
MURF_API_KEY=your_api_key
```

## Usage

```typescript
import { MurfTTS } from '@mastra/speech-murf';

// Initialize with configuration
const tts = new MurfTTS({
  model: {
    name: 'en-US-marcus', // Default voice
    apiKey: 'your-api-key', // Optional, can use MURF_API_KEY env var
  },
});

// List available voices
const voices = await tts.voices();

// Generate speech
const result = await tts.generate({
  voice: 'en-US-marcus',
  text: 'Hello from Mastra!',
});

// Stream speech
const stream = await tts.stream({
  voice: 'en-US-marcus',
  text: 'Hello from Mastra!',
});
```

## Features

- High-quality Text-to-Speech synthesis
- Multiple voice options
- Streaming support
- Natural-sounding voice synthesis
- Voice customization options
- SSML support

## Voice Options

Murf provides a variety of voices with different accents and styles:

- en-US-marcus (Male, American)
- en-US-sarah (Female, American)
- en-GB-oliver (Male, British)
- en-GB-emma (Female, British)
- en-AU-lucas (Male, Australian)
- en-AU-sophia (Female, Australian)

View the complete list in the `voices.ts` file or [Murf's documentation](https://murf.ai/docs/api).

## Additional Features

- Voice cloning capabilities
- Prosody control
- Emphasis and timing control
- Background music mixing
- Voice style variations
- Custom pronunciation dictionary
