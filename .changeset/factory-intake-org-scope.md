---
'@mastra/factory': patch
---

Fixed GitHub and Linear intake selections being personal: which repositories and Linear projects feed a Factory board is now one organization-wide setting, so every member sees the same intake instead of an empty board until they enable the sources themselves. Existing per-member selections are merged into the shared one on the next start (a source stays selected if any member had selected it), and the Intake settings now carry the Org-wide badge.
