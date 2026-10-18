---
'@mastra/core': patch
---

Fixed the 30-second default timeout for `LocalSandbox` foreground commands. A command run without a timeout could previously wait forever. Configured defaults and per-command timeouts are honored, including `0` to disable the timeout, and cloned sandboxes keep the configured default. Background processes keep their existing lifetime.
