# @mastra/voice-inworld

[Inworld AI](https://inworld.ai) voice provider for [Mastra](https://mastra.ai) — streaming TTS, batch STT, and realtime full-duplex voice.

## Installation

```bash
npm install @mastra/voice-inworld
```

## Usage

Set the API credentials required by your voice provider.

```typescript
import { CompositeVoice } from '@mastra/core/voice';
import { InworldVoice } from '@mastra/voice-inworld';
import { DeepgramVoice } from '@mastra/voice-deepgram';

const voice = new CompositeVoice({
  output: new InworldVoice({ speaker: 'Olivia' }), // Inworld for TTS
  input: new DeepgramVoice(), // Deepgram for STT
});
```

## Documentation

- [@mastra/voice-inworld documentation](https://mastra.ai/integrations/voice/inworld)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/inworld/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
