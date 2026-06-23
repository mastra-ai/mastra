---
'@internal/playground': patch
---

Fixed Studio clearing a code-defined agent's prompt when saving. A code agent that doesn't set an `editor` config is fully editable, but Studio was sending an empty instructions array on save, so saving wiped the prompt — both inline prompt blocks and referenced prompt blocks. Studio now sends the edited instructions for these agents, matching the fields the server actually persists.
