# @mastra/voice-aws-nova-sonic

Mastra AWS Nova 2 Sonic voice integration. Use `@mastra/voice-aws-nova-sonic` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/voice-aws-nova-sonic
```

## Usage

Set the API credentials required by your voice provider.

```typescript
import { NovaSonicVoice } from '@mastra/voice-aws-nova-sonic';

const voice = new NovaSonicVoice({
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'your-access-key-id',
    secretAccessKey: 'your-secret-access-key',
  },
});
```

## Documentation

- [@mastra/voice-aws-nova-sonic documentation](https://mastra.ai/reference/voice/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/aws-nova-sonic/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
