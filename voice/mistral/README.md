# @mastra/voice-mistral

Mastra Mistral voice integration. Use `@mastra/voice-mistral` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/voice-mistral
```

## Usage

Set the API credentials required by your voice provider.

```typescript
import { CompositeVoice } from '@mastra/core/voice';
import { MistralVoice } from '@mastra/voice-mistral';

const voice = new CompositeVoice({
  input: new MistralVoice(), // Voxtral for STT
  output: new MistralVoice(), // Voxtral for TTS
});
```

## Documentation

- [@mastra/voice-mistral documentation](https://mastra.ai/reference/voice/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/mistral/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
