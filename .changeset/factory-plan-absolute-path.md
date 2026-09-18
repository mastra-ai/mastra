---
'mastracode': patch
---

Fixed the Factory plan-approval card so plans submitted with an absolute artifact path now load correctly. The card normalizes absolute paths against the workspace artifacts root, rejects paths that escape it, and keeps the Approve button disabled until the plan body is actually visible — preventing approval of a plan you can't see.
