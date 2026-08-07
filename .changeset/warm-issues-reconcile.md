---
'@mastra/factory': patch
---

Work board cards now follow their GitHub issue when it closes: closing an issue moves its card to Done (or to Canceled when the issue was closed as `not_planned` or `duplicate`), and a card whose issue closed while the deployment was unreachable is caught up automatically by the periodic reconcile sweep. Previously these cards stayed on the board until moved by hand.
