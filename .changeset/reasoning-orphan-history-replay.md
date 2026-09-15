---
'@mastra/core': patch
---

Strip orphaned OpenAI reasoning/message-item pairs during history replay. When a memory-backed multi-turn thread replays an assistant turn whose reasoning item (`rs_*`) was not persisted, `@mastra/core` no longer sends the orphaned `message` item (`msg_*`) by reference to the OpenAI Responses API, which previously failed with "Item 'msg_*' of type 'message' was provided without its required 'reasoning' item". The message is now sent by value instead. itemIds are still preserved when the reasoning partner is present in the same assistant turn, so native reasoning replay is unaffected. Reasoning-capable OpenAI models now work with Memory multi-turn threads without requiring `sendReasoning: true`. Follow-up to the client-stream fix in #23323; fixes #24052.
