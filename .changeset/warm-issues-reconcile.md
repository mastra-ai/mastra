---
'@mastra/factory': patch
---

Reconcile Work board cards with closed GitHub issues. The rules engine now handles the `issues` `closed` webhook (moving the card to Done, or Canceled for `not_planned`/`duplicate` closes), and the periodic GitHub reconcile sweep also checks issue-backed cards so closes missed while a deployment was unreachable are replayed through the same ingress.
