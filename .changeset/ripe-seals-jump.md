---
'@mastra/editor': patch
---

Fixed conditional processor graphs running fallback branches alongside a matching rule. A default branch (a condition with no rules) now runs only when no explicit rule matches, and the internal pass-through only when no rule matches and no default exists, so a fallback processor no longer executes unexpected side effects when an explicit condition already matched.
