---
'@mastra/factory': patch
---

Fixed the factory stage-transition tool disappearing after a server restart. Review and work sessions resumed with "Continue" now recover their work-item binding from storage, so agents can still move cards between stages — and resumed review sessions keep their untrusted-checkout protections instead of silently losing them.
