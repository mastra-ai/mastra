### 12.16 Concurrent multi-user fan-in

Multiple users (or multiple devices for one user) sending into the same session concurrently. With agent signals, every `message(...)` call is accepted regardless of run state, and concurrent inputs interleave into the live run as additional user input. No queueing, no failures, no contention.

```ts
// Shared support thread; three users all chat into it from different tabs.
const session = await harness.session({ sessionId: 'support-thread-42' });

// All three calls return immediately; each promise resolves when the
// assistant turn answering THAT specific signal completes. Some calls may
// share an underlying assistant turn if the model batches them.
const [a, b, c] = await Promise.all([
  session.message({ content: 'I think the auth flow is broken' }),
  session.message({ content: 'Yeah, I just got logged out too' }),
  session.message({ content: 'Same here, started ~3 minutes ago' }),
]);

// If you need strict sequencing instead — each prompt as its own turn — use
// queue. Useful for scripts; almost never what you want for chat UI.
await session.queue({ content: 'Step 1: investigate' });
await session.queue({ content: 'Step 2: write a postmortem' });
await session.queue({ content: 'Step 3: file a follow-up ticket' });
```

The mental model: `message` is for "send this whenever the agent can pick it up" (chat); `queue` is for "wait for idle, then run as a standalone turn" (scripts).
