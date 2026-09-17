---
'@mastra/core': minor
'@mastra/memory': minor
---

Filter client-echoed history before memory processors load stored messages.

Memory now keeps only the current user tail or new tool results for existing threads, while preserving full sanitized input when seeding an empty thread. When an input message has the same ID as a stored message, the stored message remains the base so its reasoning, provider metadata, ordering, and timestamp are retained, while client updates such as tool results are layered on top.

This prevents lossy client echoes from orphaning OpenAI reasoning items, re-persisting user messages with client timestamps, or duplicating assistant text during history replay. Observational Memory uses the same stored-base layering behavior.

Fixes #24052.
