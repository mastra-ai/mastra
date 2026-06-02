# @mastra/voice-inworld

[Inworld AI](https://inworld.ai) voice provider for [Mastra](https://mastra.ai) — streaming TTS, batch STT, and realtime full-duplex voice.

## Installation

```bash
npm install @mastra/voice-inworld @mastra/core
```

## Quick Start

```typescript
import { InworldVoice } from '@mastra/voice-inworld';

const voice = new InworldVoice({
  speaker: 'Dennis', // 22 built-in voices available
});

// Text-to-Speech (streaming)
const audioStream = await voice.speak('Hello from Inworld!');

// Speech-to-Text
const transcript = await voice.listen(audioStream);

// List available voices
const voices = await voice.getSpeakers();
```

## Configuration

```typescript
const voice = new InworldVoice({
  speechModel: {
    name: 'inworld-tts-2', // default; also 'inworld-tts-1.5-max' or 'inworld-tts-1.5-mini'
    apiKey: 'your-key', // or set INWORLD_API_KEY env var
  },
  listeningModel: {
    name: 'groq/whisper-large-v3',
  },
  speaker: 'Dennis', // default voice
  audioEncoding: 'MP3', // MP3, WAV, OGG_OPUS, LINEAR16, PCM, ALAW, MULAW, FLAC
  sampleRateHertz: 48000, // 8000-48000
  language: 'en-US', // BCP-47 language code for STT
});
```

## Speak Options

```typescript
const stream = await voice.speak('Hello', {
  speaker: 'Olivia', // override voice
  audioEncoding: 'WAV', // override format
  sampleRateHertz: 24000, // override sample rate
  speakingRate: 1.2, // 0.5 - 1.5
  temperature: 0.8, // (0, 2] — ignored on inworld-tts-2
  deliveryMode: 'CREATIVE', // STABLE | BALANCED | CREATIVE — only honored on inworld-tts-2
  language: 'fr-FR', // BCP-47 per-call override; auto-detected when omitted
});
```

## Listen Options

```typescript
const text = await voice.listen(audioStream, {
  audioEncoding: 'AUTO_DETECT', // or 'MP3', 'LINEAR16', etc.
  sampleRateHertz: 16000,
  language: 'en-US',
});
```

## CompositeVoice

Mix Inworld with other providers:

```typescript
import { CompositeVoice } from '@mastra/core/voice';
import { InworldVoice } from '@mastra/voice-inworld';
import { DeepgramVoice } from '@mastra/voice-deepgram';

const voice = new CompositeVoice({
  output: new InworldVoice({ speaker: 'Olivia' }), // Inworld for TTS
  input: new DeepgramVoice(), // Deepgram for STT
});
```

## Available Voices

Alex, Ashley, Craig, Deborah, Dennis, Dominus, Edward, Elizabeth, Hades, Heitor, Julia, Maite, Mark, Olivia, Pixie, Priya, Ronald, Sarah, Shaun, Theodore, Timothy, Wendy.

## TTS Models

| Model                  | Quality | Latency       | Notes                                           |
| ---------------------- | ------- | ------------- | ----------------------------------------------- |
| `inworld-tts-2`        | Highest | ~200ms median | **Default.** Flagship; supports `deliveryMode`. |
| `inworld-tts-1.5-max`  | High    | ~200ms median | Previous flagship. Supports `temperature`.      |
| `inworld-tts-1.5-mini` | Good    | ~100ms median | Lower latency, reduced quality.                 |

## STT Models

| Model                   | Languages | Notes                      |
| ----------------------- | --------- | -------------------------- |
| `groq/whisper-large-v3` | 99+       | Best multilingual coverage |

## Streaming

The `speak()` method uses Inworld's streaming TTS endpoint (`/tts/v1/voice:stream`), returning audio chunks progressively as they are generated. This is ideal for agentic workflows where low time-to-first-audio matters.

## Realtime (full-duplex) voice

Alongside the batch TTS/STT `InworldVoice`, this package ships `InworldRealtimeVoice` — full-duplex, websocket-based speech-to-speech with tool calling, barge-in, and live transcripts of both sides of the conversation. Inworld runs the LLM server-side via its router, so you don't need a second model client.

Inworld's wire protocol is the OpenAI Realtime GA spec — same client/server event names (`conversation.item.added`, `conversation.item.done`, `response.output_audio.delta`, etc.). The provider-level differences are:

- Endpoint: `wss://api.inworld.ai/api/v1/realtime/session?key=<sessionId>&protocol=realtime`. The model is configured via the initial `session.update`, not the URL.
- Auth: `Authorization: Basic <key>` (Inworld keys ship pre-encoded; pass verbatim).
- Typed first-class session knobs (`audio.output.speed`, `audio.output.model`, `audio.input.turn_detection`, `audio.input.transcription`, `output_modalities`, `tool_choice`, …) via the `session` constructor field.
- A typed `providerData` object for Inworld extensions (STT tuning, TTS segmentation/steering, automatic memory, back-channel, responsiveness, plus `user_id`/`metadata`), sent under `session.providerData`.

### Usage

```typescript
import { InworldRealtimeVoice } from '@mastra/voice-inworld';

const voice = new InworldRealtimeVoice({
  apiKey: process.env.INWORLD_API_KEY,
  model: 'inworld/models/gemma-4-26b-a4b-it',
  speaker: 'Sarah',
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

### Options

| Option             | Type                            | Default                                        | Description                                                                                                                                                                     |
| ------------------ | ------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiKey`           | `string`                        | `process.env.INWORLD_API_KEY`                  | Inworld API key (Basic-encoded, passed verbatim).                                                                                                                               |
| `url`              | `string`                        | `wss://api.inworld.ai/api/v1/realtime/session` | Realtime websocket endpoint.                                                                                                                                                    |
| `model`            | `string`                        | `inworld/models/gemma-4-26b-a4b-it`            | LLM Router model ID.                                                                                                                                                            |
| `speaker`          | `string`                        | `Sarah`                                        | Default voice ID. Any catalog voice is accepted.                                                                                                                                |
| `sessionId`        | `string`                        | `voice-{Date.now()}`                           | Client-generated session key surfaced as the URL `?key=` parameter.                                                                                                             |
| `instructions`     | `string`                        | `undefined`                                    | System prompt sent with the initial `session.update`.                                                                                                                           |
| `session`          | `Partial<InworldSessionConfig>` | `undefined`                                    | Typed first-class session knobs (see below). Deep-merged into every `session.update`.                                                                                           |
| `debug`            | `boolean`                       | `false`                                        | Log raw server events.                                                                                                                                                          |
| `providerData`     | `InworldProviderData`           | `undefined`                                    | Inworld extension config sent under `session.providerData`; composes with `session.providerData` (constructor option wins on collision).                                        |
| `connectTimeoutMs` | `number`                        | `15000`                                        | Max time `connect()` will wait for both the WebSocket handshake and the initial `session.updated` round-trip. A pre-open error/close or timeout becomes a rejected `connect()`. |

#### `session` (typed knobs)

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

Other typed `session` fields:

- `audio.input.noise_reduction`: `{ type: 'near_field' | 'far_field' }` — denoise input before VAD/transcription.
- `audio.{input,output}.format`: a codec string or `{ type, rate? }` object. Supports telephony 8kHz (`audio/pcmu`, `audio/pcma`) and `audio/float32`; `rate` (Hz) applies to `audio/pcm` + `audio/float32` (default 24000).
- `audio.input.turn_detection.idle_timeout_ms`: `server_vad` only — idle window before the server commits a turn.
- `audio.input.transcription.prompt`: bias transcription with vocabulary/spelling/style hints.
- `tracing`: `'auto'` or `{ workflow_name?, group_id?, metadata? }`.
- `include`: opt-in extra event fields (e.g. `['item.input_audio_transcription.logprobs']`).
- `prompt`: a server-side prompt-template reference (string or `null`).

#### `providerData` (Inworld extensions)

`providerData` is a typed object for Inworld-specific realtime extensions. It's sent under `session.providerData` on every `session.update` and composes with any `session.providerData` you set via the `session` field — the constructor option wins on key collisions.

It has five branches plus two session-level fields:

- `stt`: STT tuning (`prompt`, `voice_profile`, `language_hints`, VAD/end-of-turn thresholds).
- `tts`: TTS segmentation and delivery (`segmenter_strategy`, `steering_handling`, `delivery_mode`, `conversational`, `user_turn_mode`, `language`).
- `memory`: automatic rolling memory (`enabled`, `turn_interval`, `max_facts`, …). Inworld echoes its state back via the `memory` event.
- `backchannel`: short acknowledgements ("uh-huh") while the user speaks. Audio arrives on the `backchannel` event.
- `responsiveness`: early "filler" audio while the main response generates. Filler audio reuses the normal `speaker`/`speaking` path — there are no distinct events.
- `user_id` and `metadata`: session-level identifiers passed through to Inworld.

```typescript
new InworldRealtimeVoice({
  providerData: {
    stt: { voice_profile: true, language_hints: ['en-US'] },
    tts: { delivery_mode: 'CREATIVE', segmenter_strategy: 'balanced' },
    memory: { enabled: true, turn_interval: 4 },
    backchannel: { enabled: true, max_per_turn: 1 },
    user_id: 'user-123',
  },
});
```

### Events

`on()` and `off()` are typed against `InworldVoiceEventMap` — known event names give you a typed callback payload, unknown event names fall back to `unknown`.

| Event                     | Payload                                                                                                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `speaking`                | `{ audio: Buffer; response_id: string }`                                                                                                                                                                                                            |
| `speaking.done`           | `{ response_id: string }`                                                                                                                                                                                                                           |
| `speaker`                 | `PassThrough` stream of PCM audio                                                                                                                                                                                                                   |
| `writing`                 | `{ text: string; response_id: string; role: 'assistant' \| 'user'; voiceProfile? }`. Deduplicated across audio-transcript + text deltas in one response. `voiceProfile` is present on user events when `providerData.stt.voice_profile` is enabled. |
| `speech-started`          | Raw server `input_audio_buffer.speech_started` payload (VAD edge).                                                                                                                                                                                  |
| `speech-stopped`          | Raw server `input_audio_buffer.speech_stopped` payload (VAD edge).                                                                                                                                                                                  |
| `interrupted`             | `{ response_id: string }`. Synthesized once per in-flight response when the user starts speaking.                                                                                                                                                   |
| `turn-suggestion`         | `{ item_id, utterance_index, probability, trailing_silence_ms?, audio_duration_ms?, inference_ms? }`. Smart-turn endpointing hint for a buffered user utterance.                                                                                    |
| `turn-suggestion-revoked` | `{ item_id, utterance_index }`. A prior `turn-suggestion` was retracted.                                                                                                                                                                            |
| `input-committed`         | `{ item_id, previous_item_id? }`. Buffered input audio was committed as a user turn (`previous_item_id` may be `null`).                                                                                                                             |
| `input-cleared`           | `{}`. Buffered input audio was discarded.                                                                                                                                                                                                           |
| `input-timeout`           | `{ audio_start_ms, audio_end_ms, item_id }`. Server-VAD idle timeout committed a user turn.                                                                                                                                                         |
| `output-audio-started`    | `{}`. Server began emitting output audio.                                                                                                                                                                                                           |
| `output-audio-stopped`    | `{}`. Server stopped emitting output audio for the current response.                                                                                                                                                                                |
| `output-audio-cleared`    | `{}`. Server output audio buffer was flushed (playback stopped).                                                                                                                                                                                    |
| `memory`                  | `InworldMemoryState` — Inworld's rolling summary/facts state (deduped by version). Requires `providerData.memory.enabled`.                                                                                                                          |
| `backchannel`             | `PassThrough` stream of back-channel PCM audio. Requires `providerData.backchannel.enabled`.                                                                                                                                                        |
| `backchannel.done`        | `{ backchannel_id: string; phrase? }`. Fires when a back-channel finishes.                                                                                                                                                                          |
| `backchannel.skipped`     | `{ reason: string }`. Fires when the decider skips a back-channel before any audio.                                                                                                                                                                 |
| `response.created`        | Full server event.                                                                                                                                                                                                                                  |
| `response.done`           | Full server event.                                                                                                                                                                                                                                  |
| `conversation.item.added` | Full server event.                                                                                                                                                                                                                                  |
| `conversation.item.done`  | Full server event.                                                                                                                                                                                                                                  |
| `function_call.arguments` | `{ call_id, name, arguments }` JSON.                                                                                                                                                                                                                |
| `tool-call-start`         | `{ toolCallId, toolName, args, … }`.                                                                                                                                                                                                                |
| `tool-call-result`        | `{ toolCallId, …, result }`.                                                                                                                                                                                                                        |
| `error`                   | `Error` (or a server error event).                                                                                                                                                                                                                  |

#### Barge-in

`speech-started` and `speech-stopped` mirror Inworld's raw VAD edges. `interrupted` is a synthetic, client-side signal: whenever `speech-started` fires while one or more responses are in flight, `interrupted` is emitted once per active `response_id`. Listen to `interrupted` to stop audio playback without having to track response state yourself.

**Back-channels are exempt from barge-in — by design.** Back-channel audio (`"uh-huh"`, `"I see"`) is meant to play _while the user is still speaking_, so it must NOT be cut off when they do. The two audio kinds are kept on separate channels so this falls out naturally:

- Main response audio arrives on the **`speaker`** event; each stream's `.id` is a `response_id`. `interrupted` only ever carries `response_id`s, so stopping the `speaker` stream whose id matches `interrupted.response_id` stops main content instantly on barge-in.
- Back-channel audio arrives on the **`backchannel`** event; each stream's `.id` is a `backchannel_id`. These ids never appear in `interrupted`, and the SDK never sends `response.cancel` for them — so a client that keys players by stream id and only kills on `interrupted` will leave back-channels playing automatically.

The one footgun: don't blanket-kill all players on barge-in. Keep back-channel players in a separate collection (or just key by stream `.id` and match only `interrupted.response_id`). Each back-channel stream ends itself on `backchannel.done`, so its player exits naturally.

```typescript
const players = new Map(); // main response audio — stopped on barge-in
const bcPlayers = new Map(); // back-channels — never stopped on barge-in

voice.on('speaker', stream => startPlayer(players, stream.id, stream));
voice.on('interrupted', ({ response_id }) => players.get(response_id)?.stop()); // main only

voice.on('backchannel', stream => startPlayer(bcPlayers, stream.id, stream)); // overlaps user speech
```

Enable back-channels with `providerData: { backchannel: { enabled: true } }` (gated by server prerequisites — contact your Inworld account team).

#### Manual turn-taking & playback signals

For push-to-talk or manual turn-taking (set `turn_detection` to `null` to disable auto-VAD), drive turns yourself:

- `commitInput()` — commit buffered input audio as a user turn.
- `clearInput()` — discard buffered input audio.
- `clearOutput()` — clear the server's **entire** output audio buffer, stopping playback. This also stops any in-flight **back-channel** audio. The default barge-in path (`response.cancel` on `interrupted`) is back-channel-safe; prefer it. Use `clearOutput()` only when you explicitly want to flush everything.

```typescript
voice.commitInput(); // end the current user turn
voice.clearInput(); // throw away what's buffered
voice.clearOutput(); // hard-stop all playback (back-channels included)
```

The server emits matching signals you can listen to:

- `turn-suggestion` / `turn-suggestion-revoked` — smart-turn endpointing hints (and retractions) for a buffered utterance.
- `input-committed` / `input-cleared` — acknowledgements for `commitInput()` / `clearInput()` (also fire on auto-VAD commits).
- `input-timeout` — a server-VAD idle timeout committed a user turn.
- `output-audio-started` / `output-audio-stopped` / `output-audio-cleared` — output playback state on the server.

```typescript
voice.on('turn-suggestion', ({ probability }) => console.log('end-of-turn?', probability));
voice.on('input-committed', ({ item_id }) => console.log('committed', item_id));
voice.on('output-audio-stopped', () => console.log('playback finished'));
```

#### Awaitable `speak()`

`speak()` resolves only after the full response lifecycle completes (`response.done` for the response it triggered). It rejects if the response is interrupted by user speech, or on a transport error. Serial calls are the supported pattern — concurrent `speak()` calls share the same listener pool and have undefined response-pinning order.

#### Default `turn_detection`

`audio.input.turn_detection` defaults to `{ type: 'semantic_vad', eagerness: 'medium', create_response: true, interrupt_response: true }`. To override, set `session.audio.input.turn_detection` to your own object. To disable turn detection entirely, set it to `null`.

`eagerness` controls how quickly semantic VAD ends a user turn — `low` waits for clearer pauses (more interruption-resistant), `high` ends turns sooner (snappier, more prone to cutting users off). Default `medium` balances both.

#### Default `transcription`

`audio.input.transcription` defaults to `{ model: 'inworld/inworld-stt-1' }`, so user-side `writing` events (with `role: 'user'`) fire out of the box. To override, set `session.audio.input.transcription` to your own object. To disable user-side transcription, set it to `null`.

### Full CLI example

A complete, terminal-based demo wiring `InworldRealtimeVoice` into a Mastra `Agent` with mic input, speaker output, semantic-VAD turn-taking, barge-in, and tool calling — all in one file.

Prereqs: Node 22+, `sox` (provides `sox` and `play`; `brew install sox` on macOS), `INWORLD_API_KEY`.

The same code as a clone-and-run repo: [github.com/cshape/inworld-mastra-cli-demo](https://github.com/cshape/inworld-mastra-cli-demo).

```typescript
import 'dotenv/config';
import { spawn, type ChildProcess } from 'node:child_process';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { InworldRealtimeVoice } from '@mastra/voice-inworld';
import { z } from 'zod';

const getCurrentTime = createTool({
  id: 'get-current-time',
  description: 'Returns the current local time.',
  inputSchema: z.object({}),
  outputSchema: z.object({ time: z.string() }),
  execute: async () => ({ time: new Date().toLocaleTimeString() }),
});

const voice = new InworldRealtimeVoice({
  model: 'openai/gpt-5.4-nano',
  speaker: 'Jason',
  session: {
    audio: {
      input: {
        transcription: { model: 'inworld/inworld-stt-1', language: 'en-US' },
        turn_detection: { type: 'semantic_vad', eagerness: 'high', interrupt_response: true },
      },
      output: { model: 'inworld-tts-2', speed: 1.0 },
    },
    temperature: 0.7,
    max_output_tokens: 150,
  },
});

new Agent({
  id: 'voice-demo',
  name: 'Voice Demo',
  instructions:
    'You are a concise voice assistant. Reply in one or two short sentences. Use the get-current-time tool when asked the time.',
  model: 'n/a',
  tools: { getCurrentTime },
  voice,
});

const SOX = ['-t', 'raw', '-r', '24000', '-e', 'signed', '-b', '16', '-c', '1', '-q', '-'];
const players = new Map<string, ChildProcess>();

voice.on('speaker', stream => {
  // Any new response supersedes the prior one — kill leftover players so
  // a missed barge-in can't leave two streams playing at once.
  for (const p of players.values()) p.kill('SIGTERM');
  players.clear();
  const id = (stream as unknown as { id: string }).id;
  const player = spawn('play', SOX, { stdio: ['pipe', 'ignore', 'ignore'] });
  players.set(id, player);
  // Swallow EPIPE when `play` exits while the PassThrough still has buffered frames.
  player.stdin!.on('error', () => {});
  stream.pipe(player.stdin!);
  player.on('exit', () => players.delete(id));
});

voice.on('interrupted', ({ response_id }) => players.get(response_id)?.kill('SIGTERM'));

let lastRole: 'user' | 'assistant' | null = null;
voice.on('writing', ({ text, role }) => {
  if (role !== lastRole) {
    process.stdout.write(role === 'user' ? '\n[you] ' : '\n[bot] ');
    lastRole = role;
  }
  process.stdout.write(text);
});

voice.on('tool-call-start', ({ toolName }) => console.log(`\n[tool] ${toolName}`));
voice.on('error', err => console.error('\n[error]', err));

await voice.connect();
console.log('Connected. Use headphones for best experience. Speak when ready. Ctrl+C to exit.');

const mic = spawn('sox', ['-d', ...SOX], { stdio: ['ignore', 'pipe', 'ignore'] });
await voice.send(mic.stdout);

process.on('SIGINT', () => {
  mic.kill('SIGTERM');
  for (const p of players.values()) p.kill('SIGTERM');
  voice.close();
  process.exit(0);
});
```

### Realtime protocol notes

These match what the live API emits (verified via raw-websocket smoke tests):

- Audio default: PCM16 @ 24kHz. Also supports telephony `audio/pcmu` / `audio/pcma` @ 8kHz and `audio/float32`.
- Server emits `session.created` on connect (older docs claim it doesn't).
- Function call args arrive via `response.function_call_arguments.delta` (singular). Some docs say plural; the docs are wrong.
- Audio deltas arrive on `response.output_audio.delta` / `…audio.done` (GA spec), not the older `response.audio.delta`.

## Authentication

Set your API key via the `INWORLD_API_KEY` environment variable or pass it in the config. Get your key from [platform.inworld.ai](https://platform.inworld.ai) → Settings → API Keys. Inworld API keys ship **already Basic-encoded** — paste verbatim; the package will not re-encode the key.
