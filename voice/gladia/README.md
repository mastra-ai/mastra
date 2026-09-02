# @mastra/voice-gladia

Gladia AI Voice integration for Mastra, providing Speech-to-text (STT) capabilities using Gladia's voice technology.

## Installation

```bash
npm install @mastra/voice-gladia
```

## Usage

Set `GLADIA_API_KEY`, then pass a readable audio stream with its file name and MIME type. Gladia is a speech-to-text provider and does not implement text-to-speech.

```typescript
import { createReadStream } from 'node:fs';
import { GladiaVoice } from '@mastra/voice-gladia';

const voice = new GladiaVoice();
const audio = createReadStream('./audio.m4a');

const transcript = await voice.listen(audio, {
  fileName: 'audio.m4a',
  mimeType: 'audio/mp4',
  options: {
    diarization: true,
    detect_language: true,
  },
});

console.log(transcript);
```

## Documentation

This README is the package guide. `GladiaVoice.listen()` uploads prerecorded audio, starts a Gladia transcription job, polls until it completes, and supports diarization, translation, language detection, and code-switching options.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/gladia/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
