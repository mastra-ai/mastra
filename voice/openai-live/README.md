# @mastra/voice-openai-live

Mastra voice provider for OpenAI's **Live API** (`gpt-live-1`), a full-duplex,
speech-to-speech interface served over the Live endpoint
`wss://api.openai.com/v1/live/sessions`.

This is a separate provider from `@mastra/voice-openai-realtime`: the Live API
uses a different endpoint, event contract, and a delegation model where the
voice layer handles the acoustic loop while reasoning/tools are delegated to a
backend model. It is not a model-id swap on the Realtime provider.

> Transport: server **WebSocket** only. WebRTC and SIP are not yet supported.

## Installation

```bash
npm install @mastra/voice-openai-live
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { OpenAILiveVoice } from '@mastra/voice-openai-live';

const agent = new Agent({
  name: 'Support Line',
  instructions: 'Be concise. Delegate anything that needs tools or deep reasoning.',
  model: 'openai/gpt-4o',
  voice: new OpenAILiveVoice({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-live-1',
    speaker: 'marin',
    delegation: {
      type: 'responses',
      responses: {
        model: 'gpt-6-luna',
        tool_choice: 'auto',
      },
    },
  }),
});

await agent.voice.connect();
agent.voice.on('speaker', stream => stream.pipe(playback));
agent.voice.on('writing', ({ text, role }) => console.log(role, text));
await agent.voice.send(getMicrophoneStream());
```

### Configuration

| Option             | Description                                                 |
| ------------------ | ----------------------------------------------------------- |
| `apiKey`           | OpenAI API key. Falls back to `process.env.OPENAI_API_KEY`. |
| `model`            | Live model id. Defaults to `gpt-live-1`.                    |
| `speaker`          | Voice id. Defaults to `marin`.                              |
| `url`              | Override the Live WebSocket URL.                            |
| `userAgent`        | `User-Agent` header identifying your app to OpenAI.         |
| `instructions`     | System instructions for the session.                        |
| `tools`            | Mastra tools advertised to the session.                     |
| `delegation`       | Backend delegation config forwarded to the Live session.    |
| `sessionConfig`    | Extra fields merged into the session config.                |
| `connectTimeoutMs` | Handshake timeout in ms (default `15000`).                  |

### Events

- `speaker` — a readable stream of output audio.
- `speaking` — `{ audio }` chunks of output audio.
- `writing` — `{ text, role }` transcript deltas (`user` or `assistant`).
- `delegation` — `{ delegationId, target }` for delegated work; under `client`
  delegation reply with `sendDelegationResult(delegationId, text)`.
- `error` — connection or protocol errors.

### Notes

Wire names follow OpenAI's GPT-Live WebSocket reference and live in
`src/protocol.ts`. The client sends `session.start` first and waits for
`session.started`; after that only the delegation can be updated.

## Documentation

- [@mastra/voice-openai-live documentation](https://mastra.ai/integrations/voice/openai-live)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/openai-live/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
