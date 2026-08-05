---
'@mastra/core': patch
---

Fixed how tool errors are stored in message history. When a tool throws (or a background task fails), the tool call is now recorded with an error state and its message in an `errorText` field, instead of being stored as a successful result. This keeps failed tool calls distinguishable from real results when messages are recalled or replayed to the model.
