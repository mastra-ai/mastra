### 13.4i First-Party Client Adapter Boundary

**First-party client adapter boundary.** A Harness-enabled Studio, Gateway,
embedded chat runtime, or controller consumes `RemoteSession` /
`RemoteSafeSession`, not a parallel agent-stream runtime. It resolves or creates
a Harness session through `MastraClient.getHarness(name)`, keeps `sessionId` as
the route/runtime identity for Session methods, per-session SSE, result lookups,
and inbox responses, and keeps `threadId` as the conversation history/navigation
identity. Legacy per-agent chat surfaces may remain for non-Harness agents, but
they are outside Harness v1 admission, settlement, pending-inbox, and reconnect
guarantees.

All Harness work enters through `RemoteSession.message(...)`,
`RemoteSession.queue(...)`, or `RemoteSession.useSkill(...)`. A Harness client
must not route settlement through legacy `getAgent(...).stream(...)`,
`getAgent(...).generate(...)`, raw stream finish handlers, or display/lifecycle
projections. Pending inbox responses post through the owning session:
parent-owned prompts use the viewed session, while subagent-owned prompts use
the `owningSessionId` / `subagentSessionId` from the event, snapshot, or
`/subagent-inbox` recovery read.

Controllers that lose local state because of browser reload, process restart,
session eviction, auth-token refresh, or SSE `412` rebuild from read models
rather than event history. They may interleave reads and stream attachment, but
the recovery inputs are the authenticated resource's `SessionListItem` rows,
`SessionSnapshot` for rendered/supervised sessions, retained operation IDs
checked through result lookup, `/subagent-inbox` for active descendant prompts,
thread message pages for persisted history, and fresh per-session `/events`
streams for sessions the controller chooses to supervise. If a reload loses a
local unresolved operation's `signalId` or `queuedItemId`, the controller can
reconstruct display state from read models but cannot settle a vanished local
promise.

Buffer overflow, epoch mismatch after eviction, and epoch mismatch after Harness
restart all converge on the same snapshot-refetch path. Clients do not branch on
the cause, synthesize missed `text_delta`, tool, channel, or lifecycle events,
open a remote cross-session event stream, or treat activity timelines, durable
work summaries, display snapshots, diagnostics, local gap markers, or
pending-card projections as operation-settlement records.
