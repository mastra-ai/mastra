---
'@mastra/factory': patch
---

Fixed GitLab boards in Factory creating cards while a list loads. Merge requests and issues that GitLab sent no webhook for now get their card from the background GitLab sweep, so they are filed even when nobody has the board open. Setting `MASTRACODE_GITLAB_RECONCILE_ENABLED=false` now also turns this discovery off.
