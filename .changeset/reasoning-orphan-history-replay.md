---
'@mastra/core': patch
---

Strip orphaned OpenAI reasoning/message-item pairs during history replay.

Previously, when a memory-backed multi-turn thread replayed an assistant turn whose reasoning item (`rs_*`) had not been persisted, `@mastra/core` sent the paired `message` item (`msg_*`) to the OpenAI Responses API by reference. The API rejected this with:

> Item 'msg_*' of type 'message' was provided without its required 'reasoning' item.

Now:

- Orphaned `msg_*` items are sent by value instead of by reference, so reasoning-capable OpenAI models work with Memory multi-turn threads without requiring `sendReasoning: true`.
- itemIds are still preserved when the reasoning partner is present in the same assistant turn, so native reasoning replay is unaffected.

Follow-up to the client-stream fix in #23323; fixes #24052.
