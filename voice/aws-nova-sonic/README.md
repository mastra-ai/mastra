# @mastra/voice-aws-nova-sonic

Mastra integration for AWS Nova 2 Sonic, providing real-time bidirectional speech-to-speech capabilities using Amazon Bedrock's bidirectional streaming API.

## Installation

```bash
npm install @mastra/voice-aws-nova-sonic
```

## Usage

### Basic Example

```typescript
import { Agent } from '@mastra/core/agent';
import { NovaSonicVoice } from '@mastra/voice-aws-nova-sonic';

const agent = new Agent({
  name: 'Nova Sonic Agent',
  instructions: 'You are a helpful assistant with real-time voice capabilities.',
  model: 'openai/gpt-4o',
  voice: new NovaSonicVoice({
    region: 'us-east-1',
    speaker: 'tiffany',
  }),
});

// Connect to the voice service
await agent.voice.connect();

// Listen for agent audio responses (stream of audio data)
agent.voice.on('speaker', audioStream => {
  // Pipe to your audio output (e.g., speaker, WebSocket, file)
  audioStream.pipe(yourAudioOutput);
});

// Listen for text transcriptions
agent.voice.on('writing', ({ text, role, generationStage }) => {
  // generationStage is 'SPECULATIVE' (preview) or 'FINAL' (actual transcript)
  console.log(`[${role}] ${text}`);
});

// Send continuous audio from the microphone (NodeJS.ReadableStream of PCM16 audio)
await agent.voice.send(microphoneStream);
```

## Documentation

- [@mastra/voice-aws-nova-sonic documentation](https://mastra.ai/integrations/voice/aws-nova-sonic)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/aws-nova-sonic/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
