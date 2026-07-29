---
'@mastra/factory': patch
---

The factory-review skill now collects existing review signal before forming a verdict — submitted reviews, top-level comments, and unresolved inline threads from bots (CodeRabbit, scanners) and humans — and must disposition every substantive prior finding as confirmed, addressed, or refuted with evidence. Verdict criteria were tightened: approval is earned rather than the default, and a confirmed major finding (the agent's own or inherited from an existing reviewer) forces a request-changes verdict instead of being downgraded to a nit.
