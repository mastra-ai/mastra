---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
---

Prompt blocks can now define their own variables schema (`requestContextSchema`), allowing you to create reusable prompt blocks with typed variable placeholders. The server now correctly computes and returns draft/published status for prompt blocks. Existing databases are automatically migrated when upgrading.
