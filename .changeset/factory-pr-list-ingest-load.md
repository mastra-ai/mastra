---
'@mastra/factory': patch
---

Fixed Factory pages loading slowly while several boards show a repository's open pull requests, as Work Intake and the Review board do. Boards no longer repeat the same pull request checks on every poll, and cards that already record their pull request are no longer saved again, so other requests stop waiting behind them.
