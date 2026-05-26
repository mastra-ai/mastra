---
'@mastra/core': patch
---

**Added `Agent.__setManagedBrowser()` so controllers can update an agent's browser without claiming ownership.**

Higher-level callers (workspace propagation, the MastraCode `/browser` command, custom harnesses) often need to push a new browser instance onto an agent while still respecting agents that were configured with their own browser at construction. `Agent.setBrowser()` always flips `hasOwnBrowser()` to `true`, which made repeated controller updates impossible to distinguish from an explicit user setting.

`__setManagedBrowser()` updates the agent's browser only when the agent does not own one explicitly, and leaves `hasOwnBrowser()` unchanged — mirroring the existing workspace-browser precedence rule. This is an internal API for harness/runtime integrators; application code should keep using `setBrowser()`.
