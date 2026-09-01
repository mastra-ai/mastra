# @mastra/voice-openai-realtime

Mastra OpenAI Realtime API integration. Use `@mastra/voice-openai-realtime` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/voice-openai-realtime
```

## Usage

Set the API credentials required by your voice provider.

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';

const voice = new OpenAIRealtimeVoice({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini-realtime',
});
```

## Documentation

- [@mastra/voice-openai-realtime documentation](https://mastra.ai/integrations/voice/openai)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/openai-realtime-api/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
