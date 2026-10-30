---
'@mastra/core': patch
---

Fixed a signal sent to a thread while an `agent.generate()` turn was running starting a second run that could not see that turn. `generate()` now registers its run with the thread like `stream()` does, so `sendSignal`, `sendMessage` and notifications with the default `ifActive: 'deliver'` join the running turn.
