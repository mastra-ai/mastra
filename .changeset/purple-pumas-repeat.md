---
'@mastra/ai-sdk': minor
---

Add `version: 'v7'` support to the AI SDK UI helpers. `toAISdkMessages()`, `toAISdkStream()`, `handleChatStream()`/`chatRoute()`, `handleNetworkStream()`/`networkRoute()`, and `handleWorkflowStream()`/`workflowRoute()` now accept `'v7'` and return streams and messages typed against AI SDK v7, so apps on AI SDK v7 no longer need casts at the route boundary.
