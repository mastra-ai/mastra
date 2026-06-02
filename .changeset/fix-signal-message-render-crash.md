---
'@mastra/core': patch
---

Fix Mastra Studio chat history crash when a thread contains a non-user-message signal (e.g. `system-reminder`).

The `toUIMessage` path in the AIV4/AIV5/AIV6 adapters was converting historical signals (`role: 'signal'`) to a UI message with `role: 'system'` and a single signal data part. assistant-ui rejects system messages that aren't a single text part with `System messages must have exactly one text message part.`, which crashed the chat view on refresh whenever the thread had a stored signal.

Map all historical signals to `role: 'user'`, matching what `signalToLLMMessage` already does at runtime. The signal payload still rides as a `data-<tagName>` UI part, so UIs see the same shape from history that they see on the live stream — they just need to look for the data part instead of branching on the message role.

Also widens the historical signal data part in AIV5/AIV6 to carry `attributes`, `acceptedAt`, and `providerOptions` alongside `metadata`, matching the live-stream signal data part shape.

Fixes mastra-ai/mastra#17414.
