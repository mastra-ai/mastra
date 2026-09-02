# @mastra/voice-modelslab

[ModelsLab](https://modelslab.com) text-to-speech integration for Mastra. It submits synthesis jobs to ModelsLab, waits for asynchronous generation to complete, downloads the result, and returns it as a Node.js readable stream.

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
  speaker: '5',
});

const audioStream = await voice.speak('Hello, world!', {
  speaker: 'nova',
  language: 'english',
  speed: 1,
});

const speakers = await voice.getSpeakers();
```

## Documentation

Pass the API key through `speechModel.apiKey` or set `MODELSLAB_API_KEY`. The constructor's `speaker` option sets the default voice and defaults to voice ID `1`. Individual `speak()` calls can override the speaker, language, and speed.

The built-in voices are:

| ID  | Name         | Gender  |
| --- | ------------ | ------- |
| `1` | Neutral      | Neutral |
| `2` | Male         | Male    |
| `3` | Warm         | Male    |
| `4` | Deep Male    | Male    |
| `5` | Female       | Female  |
| `6` | Clear Female | Female  |

OpenAI-style speaker aliases are also accepted: `alloy`, `echo`, `fable`, `onyx`, `nova`, and `shimmer` map to voice IDs `1` through `6` respectively. `getSpeakers()` returns the same voice metadata programmatically.

ModelsLab may return the audio URL immediately or a processing ID. The provider polls processing jobs every five seconds for up to five minutes, downloads the completed audio, and exposes it as a readable stream. This package does not implement speech-to-text; use a listening provider such as `@mastra/voice-deepgram` when transcription is required.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/modelslab/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
