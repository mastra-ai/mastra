---
'mastracode': patch
---

Fixed Factory page loader hang after uninstalling the GitHub App. The source-control-connections endpoint now skips connections whose installation was pruned instead of 500-ing, so the UI hydrates and the user can re-link their repos through the normal flow.
