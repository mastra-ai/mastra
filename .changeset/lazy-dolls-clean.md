---
'@mastra/factory': patch
---

Nothing changes in the chat transcript: a streamed reply still arrives part by part, at the pace it was written. That pacing now comes from `@mastra/playground-ui/components/ai/message-reveal` instead of a Factory-only copy, so every Mastra chat surface can move the same way.
