---
'@mastra/playground-ui': minor
'@mastra/core': minor
---

Changed default value of `threads.generateTitle` from `true` to `false`. Thread title auto-generation is now opt-in to avoid unexpected LLM API calls and costs. To maintain previous behavior, explicitly set `threads: { generateTitle: true }` in your memory configuration. The playground UI now displays thread IDs instead of "Chat from" when titles aren't generated.
