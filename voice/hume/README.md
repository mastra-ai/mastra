# @mastra/voice-hume

Mastra Voice integration with Hume's TTS (Text-to-Speech) API.

## Installation

```bash
npm install @mastra/voice-hume
```

## Usage

First, set your Hume API key in your environment:

```bash
export HUME_API_KEY=your_api_key_here
```

Then use it in your code:

```typescript
import { HumeVoice } from '@mastra/voice-hume';

const voice = new HumeVoice({
  speechModel: {
    apiKey: 'your-api-key', // Optional, can use HUME_API_KEY env var
  },
  speaker: 'voice-name', // Optional, voice from Hume Voice Library or custom voice
});

// List available voices
const speakers = await voice.getSpeakers();

// Generate speech
const stream = await voice.speak('Hello world', {
  speaker: 'voice-name', // Optional, defaults to constructor speaker
  format: { type: 'mp3' }, // Optional: 'mp3' | 'wav' | 'pcm'
  description: 'Warm and friendly tone', // Optional, acting/delivery instructions
});

// The stream can be piped to a destination
stream.pipe(destination);
```

## Configuration

The `HumeVoice` constructor accepts the following options:

```typescript
new HumeVoice({
  speechModel: { apiKey: 'your-api-key' }, // optional; can also use HUME_API_KEY env var
  speaker: 'voice-name', // optional default voice name or ID
});
```

## Available Voices

You can get a list of available voices from Hume's Voice Library and your custom voices:

```typescript
const speakers = await voice.getSpeakers();
// Returns: [{ voiceId: string, name?: string }, ...]
```

## Speech-to-Text

Hume does not support speech-to-text. For full voice capabilities (TTS + STT), use `CompositeVoice` with Hume for TTS and another provider like Deepgram for STT:

```typescript
import { CompositeVoice } from '@mastra/core/voice';
import { HumeVoice } from '@mastra/voice-hume';
import { DeepgramVoice } from '@mastra/voice-deepgram';

const voice = new CompositeVoice({
  input: new DeepgramVoice(),
  output: new HumeVoice({ speaker: 'your-voice' }),
});
```
