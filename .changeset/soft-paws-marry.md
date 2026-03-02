---
'@mastra/core': patch
'mastracode': patch
---

Model pack selection is now more consistent and reliable in mastracode.

- `/models` is now the single command for choosing and managing model packs.
- Model picker ranking now learns from your recent selections and keeps those preferences across sessions.
- Pack choice now restores correctly per thread when switching between threads.
- Custom packs now support full create, rename, targeted edit, and delete workflows.
- The built-in **Varied** option has been retired; users who had it selected are automatically migrated to a saved custom pack named `varied`.
