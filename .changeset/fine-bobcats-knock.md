---
'@mastra/factory': patch
---

Deployed factories now configure the resolved auth provider on both server.auth and studio.auth. Plain API callers and Studio requests (routed via the x-mastra-client-type: studio header) authenticate through the same provider, so a deployed Software Factory accepts Studio sessions without extra configuration.
