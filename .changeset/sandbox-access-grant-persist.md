---
'@mastra/core': patch
'mastracode': patch
---

Fix `request_access` granting access but the file staying unreadable. When a Harness used a dynamic workspace factory, it resolved the factory without passing the Mastra instance, so it could not dedupe against the workspace the agent already registered — producing a *separate* `Workspace`/`LocalFilesystem` instance. Harness-side tools (e.g. `request_access`) then widened a different filesystem than the agent's workspace tools (e.g. `view`) read from, so an approved path kept failing with `EACCES`. The Harness now passes its internal Mastra instance to the workspace factory so both share one filesystem instance.

`request_access` also reads the live filesystem from the harness request context (`harnessCtx.workspace.filesystem`) — the tool-execution context does not expose `workspace` for non-workspace builtins — and awaits the state persist so a subsequent workspace rebuild re-derives the allowlist including the grant.
