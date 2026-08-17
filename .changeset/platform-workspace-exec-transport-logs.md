---
'@mastra/platform-workspace': patch
---

Add warnings that make it easier to diagnose slow sandbox commands.

- Warns when a sandbox starts without a direct network address, so commands will use the slower fallback path until the next start.
- Warns when the direct network address is dropped after a failure, and includes the reason. Silent when there was nothing to drop.
- Warns once per degradation window when a command actually falls back to the slower path, with the inferred reason (probe still in flight, probe timed out, address dropped after a failure, or sidecar returned an error). Re-armed whenever the direct network address becomes available again, so each new degradation gets its own warning.
