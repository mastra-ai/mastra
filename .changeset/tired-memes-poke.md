---
'@mastra/ai-sdk': patch
'@mastra/core': patch
---

Fixed duplicate assistant messages appearing when using `useChat` with memory enabled.

**What was happening:** When using `useChat` with `chatRoute` and memory, assistant messages were being duplicated in storage after multiple conversation turns. This occurred because the backend-generated message ID wasn't being sent back to `useChat`, causing ID mismatches during deduplication.

**What changed:**
- The backend now sends the assistant message ID in the stream's start event, so `useChat` uses the same ID as storage
- Custom `data-*` parts (from `writer.custom()`) are now preserved when messages contain V5 tool parts

Fixes #11091
