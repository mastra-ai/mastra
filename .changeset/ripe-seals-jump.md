---
'@mastra/editor': patch
---

Fixed conditional processor graphs running their fallback branch alongside a matching rule. A default branch (a condition with no rules) now runs only when no explicit rule matches. The internal pass-through runs only when no rule matches and no default exists. A fallback processor no longer mutates messages or causes side effects when an explicit condition already matched.
