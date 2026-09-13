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
        model: 'gpt-4o',
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

## Configuration

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

## Events

- `speaker` — a readable stream of output audio.
- `speaking` — `{ audio }` chunks of output audio.
- `writing` — `{ text, role }` assistant transcript deltas.
- `error` — connection or protocol errors.

## Notes

The Live API is new and its event schema is still stabilizing. All wire-protocol
strings live in `src/protocol.ts` so they can be corrected in one place if
OpenAI's published schema differs.
