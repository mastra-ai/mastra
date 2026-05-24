---
'@mastra/core': patch
---

**Per-actor permission grants on Harness v1 sessions.**

`session.permissions.grantTool` / `grantCategory` / `revokeTool` / `revokeCategory` now accept an optional `actor` parameter to overlay session-level grants for a specific caller (A2A agent, channel user, CLI/server route). Two A2A callers sharing a session can hold different grant postures without affecting each other.

Adds the `HarnessActorIdentity` shape and `actorKey()` helper. Channel-originated tool calls auto-resolve through actor grants — the session derives an actor identity from the channel admission metadata (`provider:tenant:channel:platformUserId` composite) and forwards it through the request-context resolver. No caller wire-up needed for the channel path.

`applyProfile` clears every per-actor grant alongside the session-level reset, so a profile transition cannot leave stale per-caller privilege from a stronger prior posture.

Backward compatible: sessions without `actorGrants` resolve identically to pre-change behavior; legacy callers that omit `actor` from `grantTool`/`grantCategory` continue to set session-level grants.
