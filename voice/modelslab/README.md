# @mastra/voice-modelslab

[ModelsLab](https://modelslab.com) voice integration for Mastra. Provides text-to-speech using ModelsLab's TTS API.

## Installation

```bash
npm install @mastra/voice-modelslab
```

## Usage

```typescript
import { ModelsLabVoice } from '@mastra/voice-modelslab';

const voice = new ModelsLabVoice({
  speechModel: {
    apiKey: process.env.MODELSLAB_API_KEY,
  },
  speaker: '5', // Female voice
});

// Text to speech
const audioStream = await voice.speak('Hello, world!', {
  speaker: 'nova', // OpenAI-style voices also work: alloy, echo, fable, onyx, nova, shimmer
  language: 'english',
  speed: 1.0,
});

// List available voices
const speakers = await voice.getSpeakers();
```

## Documentation

This README is the package guide. `ModelsLabVoice` supports voice IDs `1` through `6`, accepts the OpenAI-style aliases `alloy`, `echo`, `fable`, `onyx`, `nova`, and `shimmer`, and returns downloaded audio as a readable stream after polling asynchronous synthesis jobs.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/modelslab/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
