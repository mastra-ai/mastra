---
'@mastra/core': patch
---

Fixed an issue where recalled assistant reasoning could appear empty after a memory round-trip for OpenRouter models (including xai/Grok formats). Recalled reasoning text is now preserved and shown correctly. Fixes #14094.
