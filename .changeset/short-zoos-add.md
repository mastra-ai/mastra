---
'@mastra/livekit': major
---

Added per-turn generation metrics, playback completion hooks, and speech-segment flushing. `onTurnComplete` keeps its generation-only behavior; `onSpeechComplete` reports server playback outcomes without changing memory persistence.

```ts
// Before: generation completion only
createLiveKitWorker({ mastra, onTurnComplete: handleGeneration });

// After: observe generation and playback separately
createLiveKitWorker({
  mastra,
  onTurnComplete: handleGeneration,
  onTurnMetrics: handleMetrics,
  onSpeechComplete: handlePlayback,
});
```

Reply generators can now emit a `VOICE_TEXT_FLUSH` boundary as well as strings. Custom string-only generators still work. Code consuming generator output directly must handle the boundary explicitly:

```ts
// Before
text += chunk;

// After
if (typeof chunk === 'string') text += chunk;
else flushSpeechSegment();
```

For `MastraLLM`, use the `mastraLLMNode` adapter in the LiveKit agent to translate these boundaries. Playback transcripts may be partial or estimated; server playback does not prove that the remote listener heard the audio.
