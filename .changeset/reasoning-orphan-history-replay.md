---
'@mastra/core': minor
'@mastra/memory': minor
---

Filter client-echoed history before memory processors load stored messages.

Memory now keeps only the current user tail or new tool results for existing threads, while preserving full sanitized input when seeding an empty thread. When an input message has the same ID as a stored message, the stored message remains the base so its reasoning, provider metadata, ordering, and timestamp are retained, while client updates such as tool results are layered on top.

This prevents lossy client echoes from orphaning OpenAI reasoning items, re-persisting user messages with client timestamps, or duplicating assistant text during history replay. Observational Memory uses the same stored-base layering behavior.

Callers that assemble the request input themselves can opt out of that filtering with the new `retainFullInput` memory option, set per call on `memory.options` or agent-wide in the memory constructor options. It processes the request input exactly as supplied without disabling history loading, and is used by the `useAgent` structured output path so its replayed request keeps the parent's prompt prefix and provider prompt caching still hits. This is a behavior change for non-standard callers that relied on supplying assistant messages through the request to modify an existing thread; use `memory.saveMessages` or the memory store's `updateMessages` for that instead.

Fixes #24052.
