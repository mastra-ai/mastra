---
'@mastra/core': patch
---

**Fixed** non-deterministic ordering of cross-thread semantic recall messages.

When messages recalled from other threads shared the same timestamp, they were rendered into the system prompt in whatever order the vector query returned them — driven by similarity scores that can vary between equivalent runs. This made any test or evaluation that snapshots prompt output (or hashes the outbound LLM request) flaky.

Recalled cross-thread messages are now sorted by createdAt, then threadId, then role (user → assistant → tool → system), then id before formatting, so the same set of recalled messages always produces the same prompt.
