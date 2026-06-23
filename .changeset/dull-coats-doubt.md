---
'@mastra/core': patch
---

Fixed agent channel initialization errors being silently swallowed. When an agent configured with channels failed to initialize during startup, the error was discarded by an un-awaited promise, leaving the channel dead with nothing logged. Initialization failures are now caught and logged through the Mastra logger so a misconfiguration surfaces clearly.
