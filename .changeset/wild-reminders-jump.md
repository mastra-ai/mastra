---
'@mastra/core': patch
---

Normalize instruction-file paths (AGENTS.md/CLAUDE.md/CONTEXT.md) to forward slashes in dynamic `system-reminder` injection. On Windows, `node:path` produced backslash-separated paths that leaked into the prompt reminders and the metadata used to avoid re-injection; paths are now identical across platforms and match the paths tool calls report. Windows filesystem APIs accept forward slashes, so file reads are unaffected.
