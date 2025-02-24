# @mastra/voice-elevenlabs

ElevenLabs Voice integration for Mastra, providing Text-to-Speech (TTS) capabilities using ElevenLabs' advanced AI voice technology.

## Installation

```bash
npm install @mastra/voice-elevenlabs
```

## Configuration

The module requires the following environment variable:

```bash
ELEVENLABS_API_KEY=your_api_key
```

## Usage

```typescript
import { ElevenLabsVoice } from '@mastra/voice-elevenlabs';

// Initialize with configuration
const voice = new ElevenLabsVoice({
  speechModel: {
    name: 'eleven_multilingual_v2',
    apiKey: 'your-api-key', // Optional, can use ELEVENLABS_API_KEY env var
  },
  speaker: 'Adam', // Default speaker
});

// List available speakers
const speakers = await voice.getSpeakers();

// Generate speech
const stream = await voice.speak('Hello from Mastra!', {
  speaker: 'Adam', // Optional, defaults to constructor speaker
});
```

## Features

- High-fidelity Text-to-Speech synthesis

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

View the complete list of voices through the `getSpeakers()` method or in [ElevenLabs' documentation](https://docs.elevenlabs.io/api-reference/voices).

## API Reference

### Constructor

```typescript
new ElevenLabsVoice({
  speechModel?: {
    name?: ElevenLabsModel, // Default: 'eleven_multilingual_v2'
    apiKey?: string,        // Optional, can use ELEVENLABS_API_KEY env var
  },
  speaker?: string         // Default speaker ID
})
```

### Methods

#### `getSpeakers()`

Returns a list of available speakers with their details.

#### `speak(input: string | NodeJS.ReadableStream, options?: { speaker?: string })`

Converts text to speech. Returns a readable stream of audio data.

#### `listen()`

Not supported - ElevenLabs does not provide speech recognition.
