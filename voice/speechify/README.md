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
    name: 'simba-3.5', // Optional, defaults to 'simba-3.5'
    apiKey: 'your-api-key', // Optional, can use SPEECHIFY_API_KEY env var
  },
  speaker: 'harper_32', // Optional, defaults to a voice that matches the model
});

// List available speakers, read live from Speechify's catalog
const speakers = await voice.getSpeakers();

// Generate speech
const stream = await voice.speak('Hello world', {
  speaker: 'harper_32', // Optional, defaults to constructor speaker
  language: 'en-US', // Optional, the voice's own locale when omitted
  audioFormat: 'mp3', // Optional: mp3, ogg, aac or pcm
});

// The stream can be piped to a destination
stream.pipe(destination);
```

### Models

- `simba-3.5`: the default and Speechify's recommended model. 48 languages on one id, and every catalog voice, cloned voices included, speaks all of them. Pass `language` to choose one.
- `simba-3.2`: English only. A non-English voice returns an error.
- `simba-3.0`: English, German, Spanish, French, Italian and Portuguese.
- `simba-english` and `simba-multilingual`: legacy ids. New workspaces get a `model_retired` error; from 2026-11-21 they are served by `simba-3.2` and `simba-3.5`.

The model can also be overridden per request:

```typescript
const stream = await voice.speak('Olá, mundo', { language: 'pt-BR' });
```

## Documentation

- [Speechify](https://mastra.ai/integrations/voice/speechify)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/speechify/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
