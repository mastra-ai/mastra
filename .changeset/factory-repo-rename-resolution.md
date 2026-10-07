---
'@mastra/factory': patch
---

Fixed runs failing with "Repository … is not linked to this Factory" after a linked GitHub or GitLab repository was renamed. Cards now resolve their repository by its stable provider ID first, so a stale `owner/name` stored on the card no longer blocks runs.
