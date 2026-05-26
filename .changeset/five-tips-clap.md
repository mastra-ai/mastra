---
'mastracode': patch
---

**Fixed `/browser` propagation across agent ownership and mode reuse.**

`/browser on`, `/browser off`, and the interactive setup flow now:

- Preserve browser configuration for agents that were wired with their own browser at construction — the global `/browser` command no longer overrides them.
- Apply changes consistently when multiple modes share the same agent, eliminating redundant updates per call.
- Keep applying across repeated `/browser on` / `off` / `on` cycles instead of locking onto the first call.

The same fix applies to the runtime-level browser propagation that runs when callers update the harness's browser at runtime.
