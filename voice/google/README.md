# @mastra/voice-google

Mastra Google voice integration. Use `@mastra/voice-google` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/voice-google
```

## Usage

Set the API credentials required by your voice provider.

```typescript
import { GoogleVoice } from '@mastra/voice-google';

const voice = new GoogleVoice({
  vertexAI: true,
  project: 'your-gcp-project',
  location: 'us-central1',
  speechModel: {
    keyFilename: '/path/to/service-account.json',
  },
  listeningModel: {
    keyFilename: '/path/to/service-account.json',
  },
});
```

## Documentation

- [@mastra/voice-google documentation](https://mastra.ai/reference/voice/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/google/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
