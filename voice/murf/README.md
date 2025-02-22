# @mastra/voice-murf

Murf Voice integration for Mastra, providing Text-to-Speech (TTS) capabilities using Murf's AI voice technology.

## Installation

```bash
npm install @mastra/voice-murf
```

## Configuration

The module requires the following environment variable:

```bash
MURF_API_KEY=your_api_key
```

## Usage

```typescript
import { MurfVoice } from '@mastra/voice-murf';
// Or generate speech from a text stream
import { Readable } from 'stream';

// Initialize with configuration
const voice = new MurfVoice({
  speechModel: {
    name: 'GEN2', // Optional, defaults to 'GEN2'
    apiKey: 'your-api-key', // Optional, can use MURF_API_KEY env var
  },
  speaker: 'en-US-natalie', // Optional, defaults to first available voice
});

// Or use with defaults (using env vars)
const defaultVoice = new MurfVoice();

// List available speakers
const speakers = await voice.getSpeakers();

// Generate speech from text
const stream = await voice.speak('Hello from Mastra!');

const textStream = Readable.from(['Hello', ' from', ' stream', ' input!']);
const audioStream = await voice.speak(textStream);

// Speech recognition is not supported
try {
  await voice.listen(audioStream);
} catch (error) {
  console.error(error); // "Murf does not support speech recognition"
}
```

## Features

- High-quality Text-to-Speech synthesis
- Multiple voice options
- Streaming support for both input and output
- Natural-sounding voice synthesis
- Voice customization options
- Default configuration support

## Voice Options

Murf provides a variety of voices with different accents and styles:

- en-US-natalie (Female, American)
- en-US-marcus (Male, American)
- en-GB-oliver (Male, British)
- en-GB-emma (Female, British)
- en-AU-lucas (Male, Australian)
- en-AU-sophia (Female, Australian)

View the complete list in the `voices.ts` file or [Murf's documentation](https://murf.ai/docs/api).
