# @mastra/voice-inworld-realtime

Inworld Realtime API integration for Mastra. Full-duplex, websocket-based voice with speech-to-speech, tool calling, and Inworld-specific features (curated voices, semantic VAD, MCP tool routing).

The protocol is the OpenAI Realtime GA spec with two deltas:

- `conversation.item.added` (Inworld) instead of `conversation.item.created`
- Inworld extension: `conversation.item.done` (per-item completion)

Sibling to [`@mastra/voice-openai-realtime`](../openai-realtime-api) and [`@mastra/voice-inworld`](../inworld) (TTS-only).

## Installation

```bash
npm install @mastra/voice-inworld-realtime
```

## Configuration

```bash
INWORLD_API_KEY=your_api_key
```

> Inworld API keys ship **already Basic-encoded**. Paste verbatim — this package will not re-encode the key.

## Usage

```typescript
import { InworldRealtimeVoice } from '@mastra/voice-inworld-realtime';

const voice = new InworldRealtimeVoice({
  apiKey: process.env.INWORLD_API_KEY,
  model: 'anthropic/claude-sonnet-4-6',
  speaker: 'Dennis',
});

await voice.connect();

voice.on('speaking', ({ audio }) => {
  // PCM16 @ 24kHz audio buffer
});

voice.on('writing', ({ text, role }) => {
  // Transcription / assistant text
});

voice.on('error', err => {
  console.error('Voice error:', err);
});

await voice.speak('Hello from Mastra!');

// Tool integration
voice.addTools({
  search: searchTool,
});

// Streaming audio in
await voice.send(microphoneStream);

// Stop
voice.close();
```

## Options

| Option         | Type                | Default                                        | Description                                                     |
| -------------- | ------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| `apiKey`       | `string`            | `process.env.INWORLD_API_KEY`                  | Inworld API key (Basic-encoded, passed verbatim).               |
| `url`          | `string`            | `wss://api.inworld.ai/api/v1/realtime/session` | Realtime websocket endpoint.                                    |
| `model`        | `string`            | `anthropic/claude-sonnet-4-6`                  | LLM Router model ID.                                            |
| `speaker`      | `string`            | `Dennis`                                       | Voice ID. Pass any voice from Inworld's catalog.                |
| `debug`        | `boolean`           | `false`                                        | Log raw server events.                                          |
| `providerData` | `Record<string, …>` | `undefined`                                    | Inworld-specific session knobs, shallow-merged on every update. |

### `providerData`

Inworld-specific knobs that don't map to the OpenAI shape live here:

```typescript
new InworldRealtimeVoice({
  providerData: {
    tool_choice: { type: 'mcp', server_label: 'my-mcp' }, // Inworld MCP routing
    audio: { output: { speed: 1.15 } }, // playback speed
  },
});
```

## Events

| Event                     | Payload                             |
| ------------------------- | ----------------------------------- |
| `speaking`                | `{ audio: Buffer, response_id }`    |
| `speaking.done`           | `{ response_id }`                   |
| `speaker`                 | `PassThrough` stream of PCM audio   |
| `writing`                 | `{ text, response_id, role }`       |
| `response.created`        | full server event                   |
| `response.done`           | full server event                   |
| `conversation.item.added` | full server event                   |
| `conversation.item.done`  | full server event (Inworld-only)    |
| `function_call.arguments` | `{ call_id, name, arguments }` JSON |
| `tool-call-start`         | `{ toolCallId, toolName, args, … }` |
| `tool-call-result`        | `{ toolCallId, …, result }`         |
| `error`                   | `Error`                             |

## Getting an API key

Sign up at [platform.inworld.ai](https://platform.inworld.ai). The key it gives you is already Basic-encoded — paste it verbatim into `INWORLD_API_KEY`.

## Protocol notes

These match what the live API emits (verified via raw-websocket smoke tests):

- Audio default: PCM16 @ 24kHz. Also supports `audio/pcmu` and `audio/pcma` @ 8kHz.
- Server emits `session.created` on connect (older docs claim it doesn't).
- Function call args arrive via `response.function_call_arguments.delta` (singular). Some docs say plural; the docs are wrong.
- Audio deltas arrive on `response.output_audio.delta` / `…audio.done` (GA spec), not the older `response.audio.delta`.

## License

Apache-2.0
