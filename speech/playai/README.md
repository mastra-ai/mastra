# @mastra/speech-playai

PlayAI Speech integration for Mastra, providing Text-to-Speech (TTS) capabilities using PlayAI's voice synthesis technology.

## Installation

```bash
npm install @mastra/speech-playai
```

## Configuration

The module requires the following environment variable:

```bash
PLAYAI_API_KEY=your_api_key
```

## Usage

```typescript
import { PlayAITTS } from '@mastra/speech-playai';

// Initialize with configuration
const tts = new PlayAITTS({
  model: {
    name: 'en-US-1', // Default voice
    apiKey: 'your-api-key', // Optional, can use PLAYAI_API_KEY env var
  },
});

// List available voices
const voices = await tts.voices();

// Generate speech
const result = await tts.generate({
  voice: 'en-US-1',
  text: 'Hello from Mastra!',
});

// Stream speech
const stream = await tts.stream({
  voice: 'en-US-1',
  text: 'Hello from Mastra!',
});
```

## Features

- High-quality Text-to-Speech synthesis
- Multiple voice options
- Streaming support
- Natural and expressive speech output
- Voice customization options

## Voice Options

PlayAI offers a selection of voices with different characteristics:

- en-US-1 (Male, American)
- en-US-2 (Female, American)
- en-GB-1 (Male, British)
- en-GB-2 (Female, British)
- en-AU-1 (Male, Australian)
- en-AU-2 (Female, Australian)

View the complete list in the `voices.ts` file or PlayAI's documentation.

## Additional Features

- Voice style customization
- Emotion control
- Speech rate adjustment
- Pitch modification
- Custom pronunciation support
