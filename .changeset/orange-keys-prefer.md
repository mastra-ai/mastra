---
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Factory runs now resolve provider credentials with org > user precedence, so an org-wide "Everyone in org" key takes priority over a run's acting user's personal key. Interactive sessions keep the existing user > org precedence. The org-first flag is stamped on factory run request contexts and parsed defensively from the request context user.
