# @mastra/voice-xai-realtime

Mastra xAI Grok Voice Agent API integration. Use `@mastra/voice-xai-realtime` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/voice-xai-realtime
```

## Usage

Set the API credentials required by your voice provider.

```typescript
import { Agent } from '@mastra/core/agent';
import { getMicrophoneStream, playAudio } from '@mastra/node-audio';
import { XAIRealtimeVoice } from '@mastra/voice-xai-realtime';

const voice = new XAIRealtimeVoice({
  apiKey: process.env.XAI_API_KEY,
  model: 'grok-voice-think-fast-1.0',
  speaker: 'eve',
  instructions: 'You are a concise voice assistant.',
  turnDetection: { type: 'server_vad' },
});

const agent = new Agent({
  id: 'voice-agent',
  name: 'Voice Agent',
  instructions: 'You are a helpful voice assistant.',
  model: 'xai/grok-4.3',
  voice,
});

await agent.voice.connect();

agent.voice.on('speaker', audioStream => {
  playAudio(audioStream);
});

agent.voice.on('writing', ({ text, role }) => {
  console.log(`${role}: ${text}`);
});

await agent.voice.speak('How can I help you today?');

const microphoneStream = getMicrophoneStream();
await agent.voice.send(microphoneStream);
```

## Documentation

- [@mastra/voice-xai-realtime documentation](https://mastra.ai/reference/voice/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/xai-realtime-api/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
