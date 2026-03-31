---
'@mastra/editor': patch
---

Code-defined agents no longer get overridden with draft version data when no version has been explicitly published. When requesting `published` status and no `activeVersionId` is set, the agent's code defaults are preserved instead of falling back to the latest draft.
