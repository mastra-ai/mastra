---
'@mastra/playground-ui': patch
---

Fixed the agent editor test chat ignoring the agent's default options. The editor test chat now applies the same model settings defaults (max tokens, max steps, provider options) as the main chat page, and activating a skill from a tool call now works in the editor test chat instead of being silently ignored.
