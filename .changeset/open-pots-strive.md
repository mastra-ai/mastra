---
'@mastra/core': patch
---

Fixed `savePerStep: true` not actually persisting messages to storage during step execution. Previously, `onStepFinish` only accumulated messages in the in-memory MessageList but never flushed them to the storage backend. The only persistence path was `executeOnFinish`, which is skipped when the stream is aborted. Now messages are flushed to storage after each completed step, so they survive page refreshes and stream aborts. Fixes https://github.com/mastra-ai/mastra/issues/13984
