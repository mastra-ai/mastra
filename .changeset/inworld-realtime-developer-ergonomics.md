---
'@mastra/voice-inworld-realtime': patch
---

Fixed Inworld Realtime API integration issues:

**Listener cleanup on reconnect.** Calling `connect()` more than once on the same instance no longer stacks duplicate internal listeners — every server event would otherwise fire N times after N reconnects.

**Barge-in events.** Added typed `speech-started`, `speech-stopped`, and `interrupted` events. `interrupted` is emitted once per in-flight `response_id` when the user starts speaking, so apps can stop audio playback on barge-in without tracking response state themselves.

**WebSocket error handling + connect timeout.** A pre-open `error` or `close` on the WebSocket no longer crashes the process — `connect()` rejects with a typed error instead. Added `connectTimeoutMs` (default 15s) covering both the WS handshake and the initial `session.updated` round-trip.

**Default semantic VAD.** `audio.input.turn_detection` now defaults to `{ type: 'semantic_vad', eagerness: 'medium', create_response: true, interrupt_response: true }` when neither `session` nor `providerData` supplies one. Set the field explicitly to override, or pass `null` to disable turn detection.

**Awaitable `speak()`.** `speak()` now resolves only after the full response lifecycle (`response.done`) and rejects on interruption or transport error, instead of returning before the server has even started speaking.

**Deduplicated `writing` event.** When both `output_audio_transcript.delta` and `output_text.delta` fire for the same response (audio+text modalities), `writing` now emits once instead of twice per chunk.

**Typed event map.** Added `InworldVoiceEventMap` and typed `on()` / `off()` overloads — `voice.on('speaking', x => x.audio.byteLength)` now typechecks without casts. Unknown event names fall through to `unknown`.

```typescript
// Before — speak returned before audio was generated; barge-in required manual tracking
await voice.connect();
voice.speak('Hello'); // resolves synchronously, before the server has spoken

// After
const voice = new InworldRealtimeVoice({ apiKey: process.env.INWORLD_API_KEY });
await voice.connect(); // rejects cleanly on handshake failure or timeout
voice.on('interrupted', ({ response_id }) => stopPlayback(response_id));
await voice.speak('Hello'); // resolves after response.done; rejects on interrupt
```
