---
'@mastra/core': patch
---

Fixed approved tool suspensions reappearing as pending after a restart. When a new session subscribed to a thread with initial history, suspensions that had already been answered could be registered again, showing stale approval prompts and making auto-resume code fail completed runs. Only suspensions on the latest assistant message are now treated as pending.
