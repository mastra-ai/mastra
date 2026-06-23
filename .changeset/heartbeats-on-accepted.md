---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

**Added** heartbeats: schedule recurring agent activity on a cron, backed by a first-class `type: 'heartbeat'` schedule target.

Heartbeats let an agent run periodically — either inside an existing thread (via `agent.sendSignal()` so subscribers receive the message through the normal channel pipeline) or in isolation (via a one-off `agent.generate()`). Each heartbeat has a random `hb_<uuid>` id and an optional `name` label, so a single agent or thread can host multiple heartbeats with different cron expressions and prompts.

```ts
// Canonical: mastra.heartbeats.*
const hb = await mastra.heartbeats.create({
  agentId: 'chef',
  name: 'morning-checkin',
  threadId,
  resourceId,
  cron: '*/5 * * * *',
  prompt: 'Check in on the user',
  ifActive: 'discard',
  ifIdle: 'wake',
});

// Threadless heartbeat: runs the agent on a cron with no thread.
await mastra.heartbeats.create({
  agentId: 'chef',
  cron: '0 * * * *',
  prompt: 'Run the hourly summary tool',
});

await mastra.heartbeats.list({ agentId: 'chef', name: 'morning-checkin' });
await mastra.heartbeats.get(hb.id);
await mastra.heartbeats.update(hb.id, { prompt: 'check in gently' });
await mastra.heartbeats.pause(hb.id);
await mastra.heartbeats.resume(hb.id);
await mastra.heartbeats.run(hb.id); // fire once now
await mastra.heartbeats.delete(hb.id);

// Filter by agent (no per-agent sugar — `mastra.heartbeats.*` is the sole CRUD surface).
await mastra.heartbeats.list({ agentId: 'chef', threadId });
```

Heartbeats survive process restarts: any persisted heartbeat row automatically starts the scheduler on boot, with no per-process registration step.

Internally heartbeats ride on a dedicated `HeartbeatWorker` consuming a
`heartbeats` pubsub topic, instead of a built-in workflow. The schedule
dispatcher (previously `WorkflowScheduler`, now `Scheduler`) generalises to
any target type and only knows about CAS, cron advancement, and topic
routing.

Heartbeat-driven runs are marked end-to-end so subscribers can distinguish
them from user-driven runs and enforce per-heartbeat broadcast policy without
any extra processor wiring:

- `signal.providerOptions.mastra.heartbeat = { scheduleId, broadcast, threadId? }`
  is stamped on the heartbeat signal (threaded) and on the `agent.generate`
  run options (threadless). It rides onto the transient `data-${signalType}`
  chunk and onto persisted messages.
- The transient signal data chunk now also carries `runId`, so consumers can
  correlate the heartbeat marker with all subsequent chunks for that run.
- `AgentChannels.consumeAgentStream` applies broadcast policy per run: `live`
  passes everything through, `on-complete` buffers text deltas and flushes a
  single text part on finish, and `never` drops the run from the channel
  entirely. Tool execution is unaffected — the agent loop still sees every
  chunk.

The heartbeat worker consumes the new `sendSignal` result contract directly:
it awaits `result.accepted` (a `Promise<SendAgentSignalAccepted>`) and derives
the terminal outcome from the resolved discriminated union
(`{ action: 'wake' | 'deliver' | 'persist' | 'discard' }`), narrowing `runId`
only on the `wake`/`deliver` arms.

### Heartbeat lifecycle hooks

React to and customise heartbeat runs via `heartbeat.hooks` on the `Mastra`
constructor, keyed by agentId (so stored agents are covered too). The shape
mirrors `agent.stream` (`onFinish` / `onError` / `onAbort`) and adds a
`prepare` hook for resolving fire-time parameters dynamically (for example,
creating a fresh Slack thread per fire and returning its `threadId` /
`resourceId`).

```ts
new Mastra({
  // ...
  heartbeat: {
    hooks: {
      chef: {
        // Resolve dynamic params at fire time. Return overrides, `null` to skip
        // this fire, or `undefined` to use the heartbeat row's defaults.
        prepare: async ({ mastra, heartbeat, trigger }) => {
          if (heartbeat.name === 'daily-digest') {
            const { threadId } = await mastra.channels.slack.chat.createThread({
              /* … */
            });
            return { threadId, resourceId: 'slack:U095PUH0FKL' };
          }
        },

        // Fires once per trigger when the trigger reached a non-error,
        // non-abort terminal state.
        onFinish: ({ outcome, result, heartbeat }) => {
          metrics.record({
            heartbeat: heartbeat.name,
            outcome, // 'succeeded' | 'delivered' | 'persisted' | 'discarded' | 'skipped'
            tokens: result?.usage?.totalTokens,
          });
        },

        // Fires when `prepare`, `sendSignal`, or the agent run threw.
        onError: ({ error, phase, heartbeat }) => {
          alerts.send(`heartbeat ${heartbeat.name} failed in ${phase}: ${error.message}`);
        },

        // Fires when the run was aborted mid-stream.
        onAbort: ({ heartbeat, runId }) => {
          logger.info({ heartbeat: heartbeat.name, runId }, 'heartbeat aborted');
        },
      },
    },
  },
});
```

Trigger row outcomes were also realigned with these hooks. The
`ScheduleTriggerOutcome` union is now `'succeeded' | 'delivered' |
'persisted' | 'discarded' | 'skipped' | 'aborted' | 'failed'`. Workflow
schedules that previously recorded `'published'` now record `'succeeded'`.

The server exposes heartbeat CRUD over HTTP via dedicated handlers, schemas,
and routes (`mastra.heartbeats.*` parity), replacing the prior
workflow-schedule shim.

**Deferred follow-up:** `Schedule.target` (currently a strict TypeScript
union in storage) and `ScheduleTrigger.outcome` will be loosened to opaque
storage and feature-owned Zod schemas (matching the `channels` /
`SlackProvider` pattern) in a follow-up PR. Hooks ship against the current
types.
