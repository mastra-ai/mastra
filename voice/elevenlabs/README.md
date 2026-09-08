# @mastra/voice-elevenlabs

Add ElevenLabs text-to-speech and speech-to-text to Mastra with configurable voices, models, audio formats, synthesis, and transcription.

## Installation

```bash
npm install @mastra/voice-elevenlabs
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

// Generate speech with custom output format (e.g., for telephony/VoIP)
const telephonyStream = await voice.speak('Hello from Mastra!', {
  speaker: 'Adam',
  outputFormat: 'ulaw_8000', // μ-law 8kHz format for telephony systems
});
```

## Documentation

- [ElevenLabs](https://mastra.ai/integrations/voice/elevenlabs)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/elevenlabs/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
