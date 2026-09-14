# @mastra/voice-deepgram

Add Deepgram text-to-speech and speech-to-text to Mastra with configurable models, voices, languages, synthesis, and streaming transcription.

## Installation

```bash
npm install @mastra/voice-deepgram
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

## Documentation

- [Deepgram](https://mastra.ai/integrations/voice/deepgram)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/deepgram/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
