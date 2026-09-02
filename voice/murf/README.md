# @mastra/voice-murf

Add Murf text-to-speech to Mastra with configurable voices, languages, styles, audio formats, synthesis options, and speaker discovery.

## Installation

```bash
npm install @mastra/voice-murf
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

## Documentation

- [Murf](https://mastra.ai/integrations/voice/murf)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/murf/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
