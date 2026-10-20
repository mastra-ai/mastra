---
'@mastra/inngest': patch
'@mastra/core': patch
---

Fixed live scorers passed to `stream()`/`generate()` via `scorers`, or set in an agent's `defaultOptions.scorers`, being skipped on the Inngest engine when they are not registered on the agent or on Mastra. They now run after the call, as they already do on the default and evented engines.
