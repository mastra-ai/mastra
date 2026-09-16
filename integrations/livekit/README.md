# @mastra/livekit

Realtime voice for [Mastra](https://mastra.ai) agents and workflows, powered by [LiveKit Agents](https://docs.livekit.io/agents/).

LiveKit's agents framework owns the **audio loop** — WebRTC transport, voice activity detection (VAD), streaming speech-to-text (STT), semantic turn detection, barge-in, and text-to-speech (TTS). This package bridges **reply generation** to Mastra, so each detected user turn is answered by a Mastra **agent** (`agent.stream()`) or **workflow** — with your tools, memory, processors, and model routing all running inside Mastra.
## Installation

```bash
npm install @mastra/livekit
```

## Usage

Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`. Add a connection route to your Mastra server so clients can receive a room token and dispatch the configured agent.

```typescript
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { liveKitConnectionRoute } from '@mastra/livekit';

const supportAgent = new Agent({
  id: 'support',
  name: 'Support agent',
  instructions: 'Keep voice responses short and conversational.',
  model: 'openai/gpt-5-mini',
});

export const mastra = new Mastra({
  agents: { supportAgent },
  server: {
    apiRoutes: [liveKitConnectionRoute({ agentName: 'mastra-voice' })],
  },
});
```

Run a separate LiveKit worker to own the audio pipeline and call the agent for each detected turn. See the quickstart for the worker setup and required LiveKit plugins.

## Documentation

- [@mastra/livekit documentation](https://mastra.ai/integrations/voice/livekit)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/integrations/livekit/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
