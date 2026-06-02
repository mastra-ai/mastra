---
'@mastra/core': minor
---

Expose an abort signal and helpers to custom channel handlers.

Channel handlers (`onDirectMessage`, `onMention`, `onSubscribedMessage`) now
receive a 4th `ctx` argument with:

- `ctx.threadId` — the Mastra thread id resolved for this chat thread
- `ctx.resourceId` — the resource id used for the thread
- `ctx.abortSignal` — an `AbortSignal` that fires when the active run on this
  thread is aborted (from anywhere: this handler, another handler on the same
  thread, `agent.abortRunStream()`, or `channels.close()`)
- `ctx.abort(reason?)` — aborts the currently active run on this thread,
  returning `true` if a run was aborted
- `ctx.activeRunId()` — the active runId on this thread, or `undefined` if idle

The 3-arg `(thread, message, defaultHandler)` form is still supported, so
existing handlers compile unchanged.

```ts
channels: {
  handlers: {
    onDirectMessage: async (thread, message, defaultHandler, ctx) => {
      if (message.text.trim().toLowerCase() === 'stop') {
        if (ctx.abort()) await thread.post('⏹️ stopped');
        return;
      }
      await defaultHandler(thread, message);
    },
  },
}
```

Resolves #17065.
