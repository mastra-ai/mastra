# @mastra/voice-openai

Mastra OpenAI speech integration. Use `@mastra/voice-openai` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/voice-openai
```

## Usage

Set the API credentials required by your voice provider.

```typescript
import { OpenAIVoice } from '@mastra/voice-openai';

const voice = new OpenAIVoice({
  speechModel: {
    name: 'tts-1',
    apiKey: process.env.OPENAI_API_KEY!,
  },
  speaker: 'alloy',
});
```

## Documentation

- [@mastra/voice-openai documentation](https://mastra.ai/integrations/voice/openai)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/openai/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
