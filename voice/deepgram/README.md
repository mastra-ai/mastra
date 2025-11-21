# @mastra/voice-deepgram

Deepgram voice integration for Mastra, providing both Text-to-Speech (TTS) and Speech-to-Text (STT) using Deepgram's Aura (TTS) and Nova (STT) families.

## Installation

```bash
npm install @mastra/voice-deepgram
```

## Configuration

The module requires a Deepgram API key, which can be provided through environment variables or directly in the configuration:

```bash
DEEPGRAM_API_KEY=your_api_key
```

## Usage

```typescript
import { DeepgramVoice } from '@mastra/voice-deepgram';

// Create voice with both speech and listening capabilities
const voice = new DeepgramVoice({
  speechModel: {
    name: 'aura', // TTS family
    apiKey: 'your-api-key', // Optional, can use DEEPGRAM_API_KEY env var
  },
  listeningModel: {
    name: 'nova', // STT family
    apiKey: 'your-api-key', // Optional, can use DEEPGRAM_API_KEY env var
  },
  speaker: 'asteria-en', // default voiceId (see voice.ts)
});

// List available voices
const voices = await voice.getSpeakers();

// Generate speech
const audioStream = await voice.speak('Hello from Mastra!', {
  speaker: 'hera-en', // override speaker voice
});

// Convert speech to text
const result = await voice.listen(audioStream, {
  diarize: true,
  diarize_speaker_count: 2,
});
console.log(result.transcript);
```

## Features

- High-quality Text-to-Speech synthesis
- Accurate Speech-to-Text transcription

## Voice Options

Deepgram provides several AI voices with different characteristics:

- aura-asteria-en (Female, American)
- aura-athena-en (Female, American)
- aura-zeus-en (Male, American)
- aura-hera-en (Female, American)
- aura-orion-en (Male, American)

View the complete list in the `voices.ts` file or [Deepgram's documentation](https://developers.deepgram.com/docs/tts-models).

### New Features

- **Speaker Selection**: You can now specify a speaker voice when initializing the `DeepgramVoice` class. This allows for more personalized speech generation.

- **Updated `speak` Method**: The `speak` method now supports an optional `speaker` parameter in the options, allowing you to dynamically choose the voice for speech synthesis.
