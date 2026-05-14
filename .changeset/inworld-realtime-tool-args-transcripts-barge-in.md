---
'@mastra/voice-inworld-realtime': patch
---

Fixed three issues surfaced by an end-to-end CLI demo:

**Zero-arg tool calls.** A tool with an empty `inputSchema` (e.g. `z.object({})`) used to crash with `"undefined" is not valid JSON` because the server sends `arguments: ""` for no-arg calls. `handleFunctionCall` now treats empty/missing arguments as `{}`.

**User-side transcripts.** Setting `session.audio.input.transcription` now causes `writing` to fire with `role: 'user'` and the final transcript. Inworld sends `input_audio_transcription.delta` events as rolling-rewrite full transcripts (not additive chunks like the OpenAI Realtime spec), so the deltas would duplicate text — `writing` is emitted only on `.completed` to avoid the duplication.

**More reliable barge-in.** `interrupted` now fires from two signal sources, deduped per `response_id`: `input_audio_buffer.speech_started` (existing) and `input_audio_transcription.delta` (new fallback). Semantic VAD can be slow to emit `speech_started` when the bot's own audio is bleeding into the mic — transcription deltas give a faster trigger. Both also send `response.cancel` to the server (gated on the user's `interrupt_response` preference) so the in-flight response actually stops streaming audio instead of just being marked interrupted client-side.

```typescript
const voice = new InworldRealtimeVoice({
  apiKey: process.env.INWORLD_API_KEY,
  session: {
    audio: {
      input: {
        transcription: { model: 'inworld/inworld-stt-1' }, // enables user `writing` events
      },
    },
  },
});

voice.on('writing', ({ text, role }) => {
  // role is now 'user' or 'assistant' — was assistant-only before
});
voice.on('interrupted', ({ response_id }) => {
  // Fires faster + more reliably; server already received `response.cancel`
});
```
