---
'@mastra/livekit': minor
---

Added opt-in transcript persistence that saves LiveKit's committed conversation in Mastra Memory. Interrupted replies retain their committed text, discarded drafts aren't saved as speech, and tool calls and results remain structured history.

Before, applications coordinated read-only generation, conversation-item listeners, retries, and shutdown flushing themselves:

```typescript
createLiveKitWorker({
  mastra,
  agent: 'support',
  memory: ({ metadata }) => ({
    thread: metadata.threadId!,
    options: { readOnly: true },
  }),
  onSessionStart: attachApplicationTranscriptWriter,
});
```

After, enable managed persistence on the worker:

```typescript
createLiveKitWorker({
  mastra,
  agent: 'support',
  transcriptPersistence: 'memory',
});
```

Custom sessions can share a `createLiveKitTranscriptPersistence()` binding with `MastraLLM`, including remote agents accessed through an existing Mastra client. Existing behavior is unchanged when the option is omitted.

Writes run outside the audio path. The next generation waits if preceding writes are unfinished, and failed writes stop that generation instead of using stale history. Stored timestamps preserve ordering, with native timestamps retained in metadata. Read-only generation reads existing working and observational memory but doesn't update them automatically.
