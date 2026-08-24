---
'@mastra/ai-sdk': patch
'@mastra/core': patch
---

Fixed suspended agent runs resuming on a newer published version. When an agent is resolved from a status selector (for example `{ status: 'published' }`), the version the run started on is now recorded when the run suspends and reused when it resumes, so approval and human-in-the-loop flows finish on the same version they started on. New runs still pick up the latest published version. Fixes #21846
