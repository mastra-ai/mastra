# @mastra/voice-gladia

Gladia speech-to-text integration for Mastra. Use it to transcribe prerecorded audio streams with optional speaker diarization, translation, language detection, and code-switching support.

## Installation

```bash
npm install @mastra/voice-gladia
```

## Usage

Set `GLADIA_API_KEY`, then pass a readable audio stream with its file name and MIME type.

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

See the [Gladia voice integration guide](https://mastra.ai/integrations/voice/gladia) and the [Mastra Voice overview](https://mastra.ai/reference/voice/overview).

`GladiaVoice` is a listening-only `MastraVoice` provider. `listen()` buffers and uploads the supplied audio stream, starts a Gladia prerecorded-transcription job, polls until processing finishes, and returns the full transcript. Both `fileName` and `mimeType` are required.

Diarization is enabled by default. Use `diarization_config` to set an exact, minimum, or maximum number of speakers. Translation can be enabled with the base or enhanced model and one or more target languages. The provider also supports automatic language detection and code switching for recordings that contain multiple languages.

The API key can be supplied as `listeningModel.apiKey` or through `GLADIA_API_KEY`. Gladia does not provide text-to-speech through this package; calling `speak()` throws an error.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/gladia/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
