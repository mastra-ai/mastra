# @mastra/ring-signals

`@mastra/ring-signals` connects Ring doorbells and cameras to Mastra agents. It receives Ring webhooks, sends each event to an agent thread as a notification signal, and adds `ring_snapshot` and `ring_clip` tools so the agent can fetch a still image or video clip for an event.

## Installation

```bash
npm install @mastra/ring-signals
npm install @mastra/memory
```

## Usage

Add `RingSignals` to an agent's `signals`. Mastra adds the Ring account-linking, webhook, and media routes to the server when the agent is registered. Linked accounts are saved in Mastra storage, so the Mastra instance needs a storage adapter.

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { RingSignals } from '@mastra/ring-signals';

export const homeAgent = new Agent({
  id: 'home-agent',
  name: 'Home Agent',
  instructions: 'Watch the front door and say briefly whether each event needs attention.',
  model: 'openai/gpt-6.1-sol',
  memory: new Memory(),
  signals: [new RingSignals()],
});
```

`RING_CLIENT_ID`, `RING_CLIENT_SECRET`, `RING_HMAC_KEY`, and `RING_BASE_URL` are read from the environment by default.

## Documentation

- [Ring](https://mastra.ai/integrations/channels/ring)
- [RingSignals reference](https://mastra.ai/reference/signals/ring-signals)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/signals/ring/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
