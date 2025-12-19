---
"@mastra/core": patch
---

Workaround for duplicate text-start/text-end IDs in multi-step agentic flows.

The `@ai-sdk/anthropic` and `@ai-sdk/google` providers use numeric indices ("0", "1", etc.) for text block IDs that reset for each LLM call. This caused duplicate IDs when an agent does TEXT → TOOL → TEXT, breaking message ordering and storage.

The fix replaces numeric IDs with UUIDs, maintaining a map per step so text-start, text-delta, and text-end chunks for the same block share the same UUID. OpenAI's UUIDs pass through unchanged.
