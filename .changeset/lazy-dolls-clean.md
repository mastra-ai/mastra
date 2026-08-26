---
'@mastra/factory': patch
---

Moved the chat transcript's streamed-reply pacing onto the shared `@mastra/playground-ui/components/ai/message-reveal` module. Nothing changes in what the transcript draws: a reply still arrives part by part, at the pace it was written.
