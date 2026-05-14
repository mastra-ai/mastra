## 1. What the Harness is

The Harness is an orchestration layer that sits between an application and the
Mastra agent runtime. It owns the lifecycle of conversations, the resolution of
models/modes/tools/skills, and the bridge between user-facing UIs and agent
execution.

This section owns the high-level architecture orientation and the canonical
Harness/Session responsibility split. Detailed mechanics stay with their
owning sections: concurrency/admission in §3, public API shape in §4, durable
storage and recovery in §5, server and wire behavior in §13, channels in §14,
and verification in §15. When this overview names those areas, treat it as a
map to the later owner rather than a second source of truth.

Channel transports (Slack, Discord, Teams, SMS, email, etc.) are one kind of
user-facing UI. Mastra's per-agent channel adapters stay per-agent; Harness
defines the bridge that makes channel ingress and outbound delivery flow through
durable `Session` state instead of bypassing it.

Two roles, cleanly split:

- **`Harness`** — restartable process-local orchestration infrastructure. Holds
  Mastra, the model resolver, the mode catalog, the skill registry, the
  workspace factory, worker configuration, and the session registry/cache.
  Created once per process. It may keep live registries, caches, workers,
  intervals, listeners, and route lifecycle state, but it does not own durable
  per-conversation state; storage does.
- **`Session`** — per-conversation runtime. Owns the mutable state of a single
conversation: its thread, mode, current model, display state, pending approvals,
in-flight operations, queue, and lease. Hydrated on demand, evicted when idle,
and closed only through the durable lifecycle.

A useful mental model:

> Think of the Harness as the building for the agent architecture. The
front desk knows which agents, modes, models, tools, memory providers,
workspaces, channels, storage backends, and workers are available. The building
coordinates conversations; it is not itself one conversation.
>
> A Session is one room in that building. It holds one durable conversation: the
current run, queue, pending decisions, state, memory/context, channel binding,
and lease. When the room is no longer live in memory, it can be reopened from
the durable record.
>
> Memory is the room notebook. It gives the agent recall, grounding, working
facts, summaries, and observational learning. It helps the room think, but it
does not decide what work exists or what must recover.
>
> Storage is the building logbook. Queue items, wakeups, channel inbox/actions,
outbox items, session state, and leases are written there before
restart-sensitive execution or provider-visible delivery.
>
> Workers are Harness/server recovery loops in the building. They read the
logbook, claim and renew ownership of claimable work rows, re-enter through the
Harness front desk to reopen rooms, rebuild the notebook and runtime services,
and continue after a crash. If their claim goes stale or the same room/runtime
surface cannot be rebuilt safely, they stop instead of guessing.
>
> Live streams, callbacks, heartbeat timers, and legacy live channel adapters
are the lights, intercoms, and whiteboards in the room. They make the room
responsive while it is open, but they are not the durable architecture.

**Memory is advisory context, not a source of durability truth.** The Harness
rebuilds working memory and observational memory from Harness-owned persisted
messages and stored observations at runtime. Memory rows are eventually
consistent, guarded by process-local locking only, and are **not** subject to
the session lease or version CAS (§5.8). They must not be the proof boundary for
queue, channel, wakeup, approval, or goal decisions — those boundaries are owned
by the durable Harness storage records. If a backend cannot provide even
advisory memory consistency, it should fail at init rather than silently degrade
context.

At overview level, that simple model means:

- **Harness = building/front desk.** It owns the registry and wiring: Mastra,
  agents, modes, model/provider resolution, tools, memory providers, workspace
  factories, channel adapters, storage, workers, readiness, and shutdown. It is
  created once per process and does not become one conversation or the durable
  owner of conversation state.
- **Session = room.** The active session owns one durable conversation for one
  `resourceId` / `threadId`: current mode/model, display state, custom state, pending
  approvals/questions/plans, current run, queue, channel binding, workspace
  state, memory context, and lease. Multiple clients attach to that room rather
  than creating parallel active rooms for the same conversation.
- **Inputs = requests at the room door.** App calls, channel events, user
  actions, and scheduled work all enter through the Harness. The exact
  admission and durable-row rules live in §3, §5, §13, and §14.
- **Runtime = services brought into the room.** The Session assembles the
  request context, memory, workspace state, model, tools, MCP bindings, and
  agent/workflow runtime. Those dependencies are used by the Session, but they
  do not own Harness durability.
- **Outputs = notes back in the logbook.** Session state, run status, pending
  responses, and provider-visible output are recorded or projected through the
  owning storage/channel rules in §5 and §14.
- **Workers = recovery loops.** Workers are Harness/server execution machinery.
  They re-enter Harness for session admission or mutation instead of becoming a
  second path around Harness; cross-source recovery lives in §5.7, readiness
  and server lifecycle live in §13.6, channel-specific claim/dispatch mechanics
  live in §14, and §15 verifies those promises.
- **Recovery = read the logbook, reopen the room.** After a crash, Harness
  rebuilds its registry, Sessions hydrate from storage, and worker-owned work
  resumes only through the later recovery contracts.
- **Live-only things are helpers, not promises.** SSE buffers, stream callbacks,
  in-memory pending resolvers, process-local intervals, and legacy live
  `AgentChannels` paths can observe or speed up work. They are not the recovery
  boundary.

Conceptual architecture flow, with Harness at the center:

Diagram blocks:

- **Ingress sources** — app calls, SDK/HTTP, channel callbacks, and scheduled or
  proactive work entering Harness.
- **Harness front desk** — the central orchestration point that resolves
  Sessions, records durable work, and routes recovery.
- **Harness storage logbook** — durable rows that survive restart:
inbox/actions,
  wakeups, current run or queue items, and outbox rows.
- **Recovery workers** — worker loops that claim durable rows and re-enter
  Harness instead of bypassing it.
- **Session room** — the per-conversation runtime that assembles memory, request
  context, workspace, model/tools, and the Mastra runtime.
- **Channel delivery** — outbox dispatch through the Harness/channel registry to
  the provider API.

The architecture below appears as five focused sub-diagrams. Each isolates one
phase so labels and arrows do not overlap; together they cover the full
lifecycle.
