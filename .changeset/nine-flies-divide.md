---
'@internal/playground': patch
---

Fixed the agent editor test chat ignoring the agent's default options. The editor test chat now applies the same model settings defaults (max tokens, max steps, provider options) as the main chat page, activating a skill from a tool call now works in the editor test chat instead of being silently ignored, and request-context plus tracing controls now use the same composer-owned run options flow as normal chat.
