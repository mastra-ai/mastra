# @mastra/speech-openai

OpenAI Speech integration for Mastra, providing Text-to-Speech (TTS) capabilities using OpenAI's advanced speech models.

## Installation

```bash
npm install @mastra/speech-openai
```

## Configuration

The module requires the following environment variable:

```bash
OPENAI_API_KEY=your_api_key
```

## Usage

```typescript
import { OpenAITTS } from '@mastra/speech-openai';

// Initialize with configuration
const tts = new OpenAITTS({
  model: {
    name: 'alloy', // Default voice
    apiKey: 'your-api-key', // Optional, can use OPENAI_API_KEY env var
  },
});

// List available voices
const voices = await tts.voices();

// Generate speech
const result = await tts.generate({
  voice: 'alloy',
  text: 'Hello from Mastra!',
});

// Stream speech
const stream = await tts.stream({
  voice: 'alloy',
  text: 'Hello from Mastra!',
});
```

## Features

- High-quality Text-to-Speech synthesis
- Multiple voice options
- Streaming support
- Natural and expressive speech output
- Fast generation times

## Voice Options

OpenAI provides several high-quality voices:

- alloy (Neutral)
- echo (Male)
- fable (Male)
- onyx (Male)
- nova (Female)
- shimmer (Female)

View the complete list in the `voices.ts` file or [OpenAI's documentation](https://platform.openai.com/docs/guides/text-to-speech).
