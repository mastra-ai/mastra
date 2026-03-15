---
'@internal/playground': minor
'@mastra/playground-ui': minor
---

Added dedicated session page for agents at `/agents/<agentId>/session`. This minimal view shows only the chat interface without the sidebar or information pane, making it ideal for quick internal testing or sharing with non-technical team members. If request context presets are configured, a preset dropdown appears in the header.

Added `hideModelSwitcher` prop to `AgentChat` and `Thread` components to allow hiding the model picker in the composer.
