---
'@mastra/factory': patch
---

Fixed Factory pages loading slowly while boards with a long Review list are open. Open boards no longer repeat the same pull request checks on every poll, and Work items that are already up to date are no longer saved again, so other requests stop waiting behind them.
