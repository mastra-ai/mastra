---
'@mastra/core': patch
---

Fix crash in `mastraDBMessageToAIV4UIMessage` when `content.parts` is undefined or null.

This resolves an issue where `ModerationProcessor` (and other code paths using `MessageList.get.*.ui()`) would throw `TypeError: Cannot read properties of undefined (reading 'length')` when processing messages with missing `parts` array. This commonly occurred when using AI SDK v4 (LanguageModelV1) models with input/output processors.

The fix adds null coalescing (`?? []`) to safely handle undefined/null `parts` in the message conversion method.
