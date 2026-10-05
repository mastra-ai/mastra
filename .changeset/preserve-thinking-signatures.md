---
'@mastra/core': patch
---

Fixed requests failing with empty assistant content after switching models mid-thread, such as from an OpenAI reasoning model to Claude. When reasoning the new provider cannot accept is removed from history, assistant turns that contained only that reasoning are now left out instead of being sent empty.
