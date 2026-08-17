---
'@mastra/platform-workspace': patch
---

Add two warnings that make it easier to diagnose slow sandbox commands.

- Warns when a sandbox starts without a direct network address, so commands will use the slower fallback path until the next start.
- Warns when the direct network address is dropped after a failure, and includes the reason. Silent when there was nothing to drop.
