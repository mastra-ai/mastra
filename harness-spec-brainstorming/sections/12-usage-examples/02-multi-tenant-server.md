### 12.2 Multi-tenant server

A web service hosting the same Harness instance for many users. Each request maps to a session.

```ts
import {
  Harness,
  HarnessBusyError,
  HarnessSessionNotFoundError,
  type Session,
} from '@mastra/core/harness/v1';

const harness = new Harness(config);
await harness.init();

// HTTP handler: send a message on behalf of the user.
app.post('/threads/:threadId/messages', async (req, res) => {
  const { user } = req.auth;
  const { threadId } = req.params;

  // Find or create the session for this thread. Different users can have
  // sessions against different threads concurrently. `session()` hits the live
  // map, falls through to storage, then creates if neither exists.
  const session = await harness.session({
    sessionId: sessionIdFor(user.id, threadId),
    threadId,
    resourceId: user.id,
  });

  // `message` is always accepted. With agent signals, concurrent posts on the
  // same thread (e.g. the same user from two tabs, or multiple users in a
  // shared session) all deliver — they drain into the live run as new user
  // input. Clients observe progress via the SSE event stream below.
  void session.message({ content: req.body.content });
  res.json({ ok: true });
});

// SSE handler: stream session events to the client.
app.get('/threads/:threadId/events', async (req, res) => {
  const { user } = req.auth;
  let session: Session;
  try {
    session = await harness.session({ sessionId: sessionIdFor(user.id, req.params.threadId) });
  } catch (err) {
    if (err instanceof HarnessSessionNotFoundError) return res.status(404).end();
    throw err;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  const unsubscribe = session.subscribe((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', unsubscribe);
});

// Memory eviction is automatic (configured via `sessions.maxLive` /
// `sessions.idleTimeoutMs` in §9) — idle sessions get flushed to storage and
// dropped from the live map, but stay resumable.
//
// If you also want to *terminate* sessions that have been idle for a long time
// (e.g., abandoned tabs older than 30 days), run a sweeper against storage:
harness.onInterval({
  id: 'idle-session-terminator',
  ms: 24 * 60 * 60_000,
  handler: async () => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60_000;
    for (const user of await getActiveUsers()) {
      const summaries = await harness.listSessions({ resourceId: user.id });
      for (const summary of summaries) {
        if (!summary.closedAt && summary.lastActivityAt < cutoff) {
          await harness.closeSession({ sessionId: summary.id });
        }
      }
    }
  },
});
```
