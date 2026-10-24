---
'@mastra/code-sdk': minor
'mastracode': minor
'@mastra/factory': minor
---

Mastra Code no longer ships the experimental Subconscious. `MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS` is now `MASTRACODE_EXPERIMENTAL_KNOWLEDGE`, and the Subconscious activity view and `ask_memory` tool are removed. Threads that already contain Subconscious activity keep working; the activity is skipped silently.
