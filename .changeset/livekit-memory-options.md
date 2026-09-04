---
'@mastra/livekit': patch
---

Add `options` to `MastraVoiceAgentMemory` so per-call memory config is forwarded by the in-process agent and remote reply generators. Setting `readOnly` keeps LiveKit's preemptive (speculative) turns from persisting partial user and assistant messages to the thread, so preemptive generation can stay on with memory; committed turns are then persisted by the caller.

```ts
new MastraLLM({
  agent,
  memory: { thread: 'thread-id', options: { readOnly: true } },
});
```

Documents the recipe and corrects the worker/plugin notes on what discarded speculations persist.
