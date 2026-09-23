# @mastra/voice-cloudflare

Add low-latency text-to-speech to Mastra with Cloudflare Workers AI, configuring models, speakers, audio output, and edge-friendly synthesis.

## Installation

```bash
npm install @mastra/voice-cloudflare
```

## Usage

```typescript
import { CloudflareVoice } from '@mastra/voice-cloudflare';

const voice = new CloudflareVoice({
  listeningModel: {
    apiKey: process.env.CLOUDFLARE_API_TOKEN,
    account_id: process.env.CLOUDFLARE_ACCOUNT_ID,
    model: '@cf/openai/whisper-large-v3-turbo',
  },
});

// Generate Text from an audio stream
const text = await voice.listen(audioStream);
```

## Documentation

- [Cloudflare](https://mastra.ai/integrations/voice/cloudflare)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/cloudflare/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
