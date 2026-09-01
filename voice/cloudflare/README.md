# @mastra/voice-cloudflare

Mastra Cloudflare AI voice integration. Use `@mastra/voice-cloudflare` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/voice-cloudflare
```

## Usage

Set the API credentials required by your voice provider.

```typescript
import { CloudflareVoice } from '@mastra/voice-cloudflare';

// Native Bindings
const voice = new CloudflareVoice({
  binding: env.AI,
  listeningModel: {
    model: '@cf/openai/whisper-large-v3-turbo',
  },
});

// REST API
const voice = new CloudflareVoice({
  listeningModel: {
    apiKey: 'YOUR_API_KEY',
    model: '@cf/openai/whisper-large-v3-turbo',
    account_id: 'YOUR_ACC_ID',
  },
});

// Generate Text from an audio stream
const text = await voice.listen(audioStream);
```

## Documentation

- [@mastra/voice-cloudflare documentation](https://mastra.ai/integrations/voice/cloudflare)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/cloudflare/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
