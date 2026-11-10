---
'@mastra/factory': patch
---

Fixed Factory pages slowing down while several boards show a repository's open GitHub issues, as Work Intake and triage do. Boards no longer repeat the same issue checks on every poll: each page of issues is checked by one board at a time and then left alone for a short while, the same way pull request lists already work.
