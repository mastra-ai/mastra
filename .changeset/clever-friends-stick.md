---
'@mastra/client-js': patch
---

Fixed `agent.generate()` and `agent.stream()` in the client SDK rejecting a plain-object `requestContext` at the type level. They now accept `RequestContext | Record<string, any>`, like the other client methods. Fixes #29576.
