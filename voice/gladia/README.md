# @mastra/voice-gladia

Gladia AI Voice integration for Mastra, providing Speech-to-text (STT) capabilities using Gladia's voice technology.

## Installation

```bash
npm install @mastra/voice-gladia
```

## Usage

```typescript
import { GladiaVoice } from '@mastra/voice-gladia';
import { createReadStream } from 'fs';
import path from 'path';

const voice = new GladiaVoice({
  listeningModel: {
    apiKey: process.env.GLADIA_API_KEY!,
  },
});

// Create an agent with voice capabilities
// Note: Gladia only supports STT, so the agent will only be able to listen.
export const agent = new Agent({
  id: 'voice-agent',
  name: 'Voice Agent',
  instructions: `You are a helpful assistant with STT capabilities.`,
  model: google('gemini-1.5-pro-latest'),
  voice: voice,
});

// Example usage with a local audio file
const audioStream = createReadStream(path.join(process.cwd(), 'audio.m4a'));

try {
  const text = await voice.listen(audioStream, {
    fileName: 'audio.m4a',
    mimeType: 'audio/mp4',
  });
  console.log('Transcription:', text);
} catch (error) {
  console.error('Error transcribing audio:', error);
}
```

## Documentation

- [@mastra/voice-gladia documentation](https://mastra.ai/reference/voice/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/gladia/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
