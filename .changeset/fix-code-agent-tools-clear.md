---
'@internal/playground': patch
---

Fixed Studio dropping a code-defined agent's tools when saving. A code agent that doesn't set an `editor` config is fully editable, but Studio was leaving the tools out of the save request, so tool changes (and description overrides) were silently discarded. Studio now sends the edited tools for these agents, matching the fields the server actually persists.
