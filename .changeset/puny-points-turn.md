---
'@mastra/factory': patch
---

Added opt-in operation timing logs to Factory. Set `FACTORY_TIMING=1` to log the duration of every HTTP request, storage call, and sandbox command as `[factory:timing]` lines, to help find slow requests in deployed Factories.
