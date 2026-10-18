---
'@mastra/core': patch
---

Fixed the goal judge reading the `TrailingAssistantGuard`'s synthetic `Continue.` turn as the latest user message. On models that reject a trailing assistant turn (Claude 4.6+, Gemini 3+), the judge was told the user had said `Continue.` when they had not, hiding the real latest user message and miscounting assistant steps since it. The guard now marks its continuation, and the goal judge skips it.
