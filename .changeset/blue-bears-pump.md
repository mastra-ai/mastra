---
'@mastra/livekit': minor
---

Added an `onTurnComplete` hook to `createLiveKitWorker`. It fires once per turn after the reply has finished streaming to text-to-speech — off the audio path and fire-and-forget (the worker never awaits it) — so post-turn work like memory maintenance, CRM writes, or analytics never adds to the caller's latency or delays the next turn.

The hook receives the produced reply and the call's memory mapping, so it's the right place for a fully non-blocking `memory.updateWorkingMemory(...)`. It also fires with `result.interrupted: true` when barge-in cuts a turn short.

```ts
createLiveKitWorker({
  mastra,
  agent: 'callCenter',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  onTurnComplete: async ({ result, memory }) => {
    // Runs after the caller has heard the reply — fire-and-forget, off the audio path.
    if (!memory) return;
    await crm.logContact(memory.resource, result.text);
  },
});
```
