### 12.16 Concurrent multi-user fan-in

Multiple message producers sending into the same session concurrently through
signal-driven `message(...)` calls. §3 owns the concurrency and settlement
rules.

All participants in a shared session must resolve to one logical `resourceId`,
such as a team account, project, support queue, or shared channel binding.
Individual humans are actors inside that resource, not separate Harness
resources (§2.3). For channel-origin fan-in, the bridge records the message
author in `requestContext.channel.actor` while the binding keeps one logical
resource (§14.1, §14.3).

```ts
// Shared support thread for one logical support account. Three authorized
// teammates all chat into it from different tabs, but they share the same
// Harness resource boundary.
const session = await harness.session({
  threadId: 'support-thread-42',
  resourceId: 'support:account:acme',
});

// All three calls admit under the same resourceId; each promise resolves when
// the assistant turn answering THAT specific signal completes.
// Some calls may share an underlying assistant turn if the model batches them.
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

See §3 for the canonical `message` vs. `queue` behavior.
