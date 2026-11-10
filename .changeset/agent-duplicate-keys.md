---
'@mastra/core': patch
'@mastra/editor': patch
---

Reject conflicting agent registrations with an explicit duplicate-key error, while preserving stored-agent version lookups and controller modes that share an agent ID.
