# @mastra/voice-minimax

Add MiniMax text-to-speech to Mastra with regional endpoints, current speech models, and configurable audio settings.

## Installation

```bash
npm install @mastra/voice-minimax
```

## Usage

Set `MINIMAX_API_KEY`, then provide a voice ID when you create the provider.

```typescript
import { MiniMaxVoice } from '@mastra/voice-minimax';

const voice = new MiniMaxVoice({
  speechModel: {
    name: 'speech-2.8-hd',
  },
  speaker: process.env.MINIMAX_VOICE_ID,
});

const audioStream = await voice.speak('Hello from Mastra');
audioStream.pipe(destination);
```

Set `speechModel.region` to `china` to use `https://api.minimaxi.com/v1/t2a_v2`. The default `global` region uses `https://api.minimax.io/v1/t2a_v2`.

Pass request settings through `speechModel.properties` or `speak()` options. Supported audio formats are `mp3`, `wav`, `flac`, and `pcm`.

## Documentation

- [MiniMax voice integration](https://mastra.ai/integrations/voice/minimax)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/minimax/CHANGELOG.md) for version history and release notes.

## Support

Join the [Mastra Discord](https://discord.gg/mastra-ai) for help and discussion.
