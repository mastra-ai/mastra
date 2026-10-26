---
'@mastra/inngest': patch
---

Fixed a second `InngestAgent.resume()` failing with "the nested iteration snapshot does not contain suspended tool calls" when a run suspended again on a new tool call. Resume now waits until the stored suspension matches the latest suspended tool call.
