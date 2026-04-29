---
'@internal/playground': patch
---

Fixed integration tools (Arcade, Composio) and registry tools not being properly saved or removed when editing agents. Previously, removing all tools from an agent and saving a draft would cause the old tools to reappear, and adding tools via a tool provider could fail to persist.
