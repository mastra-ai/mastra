---
'@mastra/editor': patch
---

Fixed `editor.agent.clearCache()` leaving version-specific stored agents registered in Mastra. The Editor agent namespace now tracks its runtime registrations separately from the value cache so clear-all removes stored agents loaded by version ID, version number, or status while preserving code-defined agents. Fixes #23966.
