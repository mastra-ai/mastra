# @mastra/voice-speechify

Add Speechify text-to-speech to Mastra with configurable voices, languages, audio formats, synthesis controls, and speaker discovery.

## Installation

```bash
npm install @mastra/voice-speechify
```

## Usage

Set the API credentials required by your voice provider.

```typescript
import { SpeechifyVoice } from '@mastra/voice-speechify';

const voice = new SpeechifyVoice({
  speechModel: {
    name: 'simba-3.2', // Optional, defaults to 'simba-english'
    apiKey: 'your-api-key', // Optional, can use SPEECHIFY_API_KEY env var
  },
  speaker: 'harper_32', // Optional, defaults to a voice that matches the model
});

// List available speakers
const speakers = await voice.getSpeakers();

// Generate speech
const stream = await voice.speak('Hello world', {
  speaker: 'harper_32', // Optional, defaults to constructor speaker
  // Additional Speechify options
  audioFormat: 'mp3',
});

// The stream can be piped to a destination
stream.pipe(destination);
```

## Documentation

- [Speechify](https://mastra.ai/integrations/voice/speechify)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/speechify/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
