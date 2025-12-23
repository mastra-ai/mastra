---
"@mastra/core": patch
---

fix(core): prevent reasoning itemId from being used as assistant message id

Fixed an issue where OpenAI reasoning models would fail with "reasoning item without required following item" error on follow-up messages. The problem was that text parts were incorrectly inheriting the reasoning's `providerMetadata` (containing `openai.itemId: 'rs_...'`), which the OpenAI SDK then used as the assistant message's `id`. This caused OpenAI to reject the request because assistant messages must have `msg_` prefixed IDs.

The fix introduces `textProviderMetadata` to capture text-specific metadata separately from reasoning metadata, ensuring text parts don't inherit the reasoning's `itemId`.

Fixes #11103

