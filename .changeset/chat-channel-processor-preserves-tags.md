---
'@mastra/core': patch
---

Fixed Observational Memory and other tagged system context being lost when an agent uses Channels. Channel-specific context now adds itself alongside other processors' system messages instead of replacing them.
