---
'@mastra/core': patch
---

Fixed CostGuardProcessor thread and resource scope resolution when running without auth middleware (e.g. Studio dev mode). The processor now falls back to the MastraMemory context on RequestContext to resolve threadId and resourceId, matching the pattern used by other processor helpers.
