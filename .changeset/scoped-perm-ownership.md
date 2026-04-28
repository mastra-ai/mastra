---
'@mastra/server': patch
---

Fix: broad role grants (e.g. the default `member` role's `agents:read` / `agents:execute`) no longer bypass stored-agent ownership. A caller must now hold an id-scoped grant (e.g. `agents:read:<id>`) to override the owner/visibility gate on a specific record. Unscoped grants continue to gate route access at the `requiresPermission` layer as before. This closes a hole where any authenticated member could stream or read another user's private stored agent.
