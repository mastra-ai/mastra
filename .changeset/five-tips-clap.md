---
'mastracode': patch
---

**Fixed `/browser` propagation across agent ownership and mode reuse.**

`/browser on`, `/browser off`, and the interactive setup flow now:

- Preserve browser configuration for agents that were wired with their own browser at construction — the global `/browser` command no longer overrides them.
- Apply changes consistently when multiple modes share the same agent, eliminating redundant updates per call.
- Keep applying across repeated `/browser on` / `off` / `on` cycles instead of locking onto the first call. The runtime-level browser propagation that runs when the harness's browser is updated at runtime gets the same fix.

Builds on the matching `@mastra/core` change that lets controllers update an agent's browser without claiming explicit ownership.
