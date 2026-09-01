# @mastra/voice-google-gemini-live

Mastra Google Gemini Live API integration. Use `@mastra/voice-google-gemini-live` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/voice-google-gemini-live
```

## Usage

Set the API credentials required by your voice provider.

```typescript
import { GeminiLiveVoice } from '@mastra/voice-google-gemini-live';

const voice = new GeminiLiveVoice({
  apiKey: process.env.GOOGLE_API_KEY!,
  model: 'gemini-2.0-flash-exp',
  speaker: 'Puck',
});
```

## Documentation

- [@mastra/voice-google-gemini-live documentation](https://mastra.ai/integrations/voice/google)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/google-gemini-live-api/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
