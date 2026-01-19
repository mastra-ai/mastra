---
"@mastra/react": patch
---

Fix text parts incorrectly merging across tool calls

Previously, when an agent produced text before and after a tool call (e.g., "Let me search for that" → tool call → "Here's what I found"), the text parts would be merged into a single part, losing the separation. This fix introduces a `textId` property to track separate text streams, ensuring each text stream maintains its own text part in the UI message.

Fixes #11577
