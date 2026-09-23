---
'@mastra/core': minor
'@mastra/memory': minor
---

Filter client-echoed history before memory processors load stored messages.

On a thread that already has stored messages, memory now keeps only the new part of the request input: the trailing user messages, plus any tool outcomes the client sends for calls the stored conversation still has pending (results, errors, denials, and approval answers). This works whether the outcome arrives on its own or together with the next user message. An empty thread is still seeded with the full input, with assistant provider metadata stripped.

When an input message has the same ID as a stored message, the stored message remains the base so its reasoning, provider metadata, ordering, and timestamp are retained. Client tool outcomes only fill in calls that are still pending, so an echo can't overwrite a stored tool result.

This prevents lossy client echoes from orphaning OpenAI reasoning items, re-persisting user messages with client timestamps, or duplicating assistant text during history replay. Observational Memory uses the same stored-base layering behavior.

This is a behavior change: on an existing thread, any input message before the last assistant message that isn't stored is removed. That includes few-shot examples and caller-assembled message arrays, not only assistant messages sent to modify the thread or user messages re-sent with a changed `createdAt` to reorder it. Use `memory.saveMessages` or the memory store's `updateMessages` to change stored history.

To opt out, set the new `retainFullInput` memory option, per call on `memory.options` or agent-wide in the memory constructor options. The request input is then processed exactly as supplied, history still loads, and every input message that isn't already stored is saved to the thread. The `useAgent` structured output path uses it so its replayed request keeps the parent's message prefix.

Fixes #24052.
