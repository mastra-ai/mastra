---
'@mastra/livekit': minor
---

Added per-call speech-to-text and text-to-speech selection to `createLiveKitWorker`. Set the new `configuration.stt` and `configuration.tts` resolvers to pick the transcriber and voice for each call — one voice or language per tenant — keyed off the dispatch metadata and request context. Each resolver runs once per call and falls back to the top-level `stt` / `tts` option when it returns `undefined`.

```ts
export default createLiveKitWorker({
  mastra,
  agent: 'support',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3', // fallback voice
  configuration: {
    // Give each tenant its own voice, resolved per call from the dispatch metadata.
    tts: ({ metadata }) => tenantVoices[metadata.requestContext?.tenant as string],
  },
});
```

Previously the worker's speech pipeline was fixed at construction, so a multi-tenant worker could not vary voices or transcription per call. Customers who own their LiveKit session (the `MastraLLM` plugin path) already choose STT/TTS per call by construction; this brings the same flexibility to the batteries-included worker.
