---
'mastracode': patch
---

Updated thinking-level labels in Mastra Code UI to be provider-aware for OpenAI models.

- `/think` and Settings now use shared label metadata
- OpenAI models show provider-specific labels (for example, `Very High (xhigh)`)
- Stored `thinkingLevel` values remain unchanged (`off`, `low`, `medium`, `high`, `xhigh`)
