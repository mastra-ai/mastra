# @mastra/voice-google

Add Google Cloud text-to-speech and speech-to-text to Mastra with configurable voices, languages, audio encoding, streaming, and authentication.

## Installation

```bash
npm install @mastra/voice-google
```

## Usage

### Standard Usage

```typescript
import { GoogleVoice } from '@mastra/voice-google';

// Initialize with configuration
const voice = new GoogleVoice({
  speechModel: {
    apiKey: 'your-api-key', // Optional, can rely on GOOGLE_API_KEY or ADC
    keyFilename: '/path/to/service-account.json', // Optional, can rely on GOOGLE_APPLICATION_CREDENTIALS
  },
  listeningModel: {
    keyFilename: '/path/to/service-account.json', // Optional, can rely on ADC
  },
  speaker: 'en-US-Standard-F', // Default voice
});

// List available voices
const voices = await voice.getSpeakers();

// Generate speech
const audioStream = await voice.speak('Hello from Mastra!', {
  speaker: 'en-US-Standard-F',
  languageCode: 'en-US',
});

// Transcribe speech
const text = await voice.listen(audioStream);
```

## Documentation

- [Google](https://mastra.ai/integrations/voice/google)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/google/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
