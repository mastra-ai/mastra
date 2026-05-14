# @mastra/voice-inworld-realtime

Inworld Realtime API integration for Mastra. Full-duplex, websocket-based voice with speech-to-speech, tool calling, and Inworld-specific features (curated voices, semantic VAD, MCP tool routing).

Inworld's wire protocol is the OpenAI Realtime GA spec — same client/server event names (`conversation.item.added`, `conversation.item.done`, `response.output_audio.delta`, etc.). The provider-level differences are:

- Endpoint: `wss://api.inworld.ai/api/v1/realtime/session?key=<sessionId>&protocol=realtime`. The model is configured via the initial `session.update`, not the URL.
- Auth: `Authorization: Basic <key>` (Inworld keys ship pre-encoded; pass verbatim).
- Typed first-class session knobs (`audio.output.speed`, `audio.output.model`, `audio.input.turn_detection`, `audio.input.transcription`, `output_modalities`, `tool_choice`, …) via the `session` constructor field.
- An untyped `providerData` escape hatch for fields Inworld may add ahead of typed support. Both are deep-merged into every `session.update`.

Sibling to [`@mastra/voice-openai-realtime`](https://github.com/mastra-ai/mastra/tree/main/voice/openai-realtime-api) and [`@mastra/voice-inworld`](https://github.com/mastra-ai/mastra/tree/main/voice/inworld) (TTS + STT).

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
  instructions: 'You are a helpful voice assistant.',
  // Typed first-class session knobs:
  session: {
    audio: {
      output: { speed: 1.1 },
      input: {
        transcription: { model: 'inworld/inworld-stt-1' },
        turn_detection: { type: 'semantic_vad', eagerness: 'high' },
      },
    },
  },
});

await voice.connect();

voice.on('speaker', stream => {
  // PCM16 @ 24kHz stream — pipe to your audio output
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

| Option             | Type                            | Default                                        | Description                                                                                                                                                                     |
| ------------------ | ------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiKey`           | `string`                        | `process.env.INWORLD_API_KEY`                  | Inworld API key (Basic-encoded, passed verbatim).                                                                                                                               |
| `url`              | `string`                        | `wss://api.inworld.ai/api/v1/realtime/session` | Realtime websocket endpoint.                                                                                                                                                    |
| `model`            | `string`                        | `anthropic/claude-sonnet-4-6`                  | LLM Router model ID.                                                                                                                                                            |
| `speaker`          | `string`                        | `Dennis`                                       | Default voice ID. Any catalog voice is accepted.                                                                                                                                |
| `sessionId`        | `string`                        | `voice-{Date.now()}`                           | Client-generated session key surfaced as the URL `?key=` parameter.                                                                                                             |
| `instructions`     | `string`                        | `undefined`                                    | System prompt sent with the initial `session.update`.                                                                                                                           |
| `session`          | `Partial<InworldSessionConfig>` | `undefined`                                    | Typed first-class session knobs (see below). Deep-merged into every `session.update`.                                                                                           |
| `debug`            | `boolean`                       | `false`                                        | Log raw server events.                                                                                                                                                          |
| `providerData`     | `Record<string, unknown>`       | `undefined`                                    | Untyped escape hatch for fields Inworld adds before typed support lands. Also deep-merged.                                                                                      |
| `connectTimeoutMs` | `number`                        | `15000`                                        | Max time `connect()` will wait for both the WebSocket handshake and the initial `session.updated` round-trip. A pre-open error/close or timeout becomes a rejected `connect()`. |

### `session` (typed knobs)

Use the typed `session` field for known Inworld realtime options. Fields compose with the connect-time defaults (e.g. `audio.output.voice` set from `speaker`):

```typescript
new InworldRealtimeVoice({
  speaker: 'Dennis',
  session: {
    output_modalities: ['audio', 'text'],
    audio: {
      output: { speed: 1.15, model: 'inworld-tts-2' },
      input: {
        transcription: { model: 'inworld/inworld-stt-1', language: 'en-US' },
        turn_detection: { type: 'semantic_vad', eagerness: 'medium' },
      },
    },
    tool_choice: { type: 'mcp', server_label: 'my-mcp' },
    temperature: 0.6,
  },
});
```

### `providerData` (untyped escape hatch)

Use `providerData` for fields not yet covered by the typed `session` interface — Inworld can roll out new realtime knobs faster than this package picks them up. Anything you put here is deep-merged into every `session.update`, and overrides `session` on key collisions.

```typescript
new InworldRealtimeVoice({
  providerData: {
    // Hypothetical forward-compat fields:
    some_new_realtime_feature: true,
  },
});
```

## Events

`on()` and `off()` are typed against `InworldVoiceEventMap` — known event names give you a typed callback payload, unknown event names fall back to `unknown`.

| Event                     | Payload                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `speaking`                | `{ audio: Buffer; response_id: string }`                                                                                                  |
| `speaking.done`           | `{ response_id: string }`                                                                                                                 |
| `speaker`                 | `PassThrough` stream of PCM audio                                                                                                         |
| `writing`                 | `{ text: string; response_id: string; role: 'assistant' \| 'user' }`. Deduplicated across audio-transcript + text deltas in one response. |
| `speech-started`          | Raw server `input_audio_buffer.speech_started` payload (VAD edge).                                                                        |
| `speech-stopped`          | Raw server `input_audio_buffer.speech_stopped` payload (VAD edge).                                                                        |
| `interrupted`             | `{ response_id: string }`. Synthesized once per in-flight response when the user starts speaking.                                         |
| `response.created`        | Full server event.                                                                                                                        |
| `response.done`           | Full server event.                                                                                                                        |
| `conversation.item.added` | Full server event.                                                                                                                        |
| `conversation.item.done`  | Full server event.                                                                                                                        |
| `function_call.arguments` | `{ call_id, name, arguments }` JSON.                                                                                                      |
| `tool-call-start`         | `{ toolCallId, toolName, args, … }`.                                                                                                      |
| `tool-call-result`        | `{ toolCallId, …, result }`.                                                                                                              |
| `error`                   | `Error` (or a server error event).                                                                                                        |

### Barge-in

`speech-started` and `speech-stopped` mirror Inworld's raw VAD edges. `interrupted` is a synthetic, client-side signal: whenever `speech-started` fires while one or more responses are in flight, `interrupted` is emitted once per active `response_id`. Listen to `interrupted` to stop audio playback without having to track response state yourself.

### Awaitable `speak()`

`speak()` resolves only after the full response lifecycle completes (`response.done` for the response it triggered). It rejects if the response is interrupted by user speech, or on a transport error. Serial calls are the supported pattern — concurrent `speak()` calls share the same listener pool and have undefined response-pinning order.

### Default `turn_detection`

`audio.input.turn_detection` defaults to `{ type: 'semantic_vad', eagerness: 'medium', create_response: true, interrupt_response: true }`. To override, set `session.audio.input.turn_detection` (or `providerData.audio.input.turn_detection`) to your own object. To disable turn detection entirely, set it to `null`.

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
