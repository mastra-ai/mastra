---
'@mastra/core': patch
---

Persist session preferences (thinking level, notifications) to thread metadata so they survive a server restart. Session state is in-memory only; mode and model selections were already restored from thread metadata by `Session.loadMetadata()`, but `thinkingLevel` and `notifications` were not, so they silently reverted to defaults whenever the host process restarted (e.g. self-hosted Factory). State updates to these keys are now mirrored into thread metadata and restored when a session binds to the thread.
