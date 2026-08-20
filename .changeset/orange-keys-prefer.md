---
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Factory runs now resolve provider credentials with org > user precedence, so an org-wide "Everyone in org" key takes priority over a run's acting user's personal key. This means factory automation always bills against the org's shared credentials when they exist, regardless of who triggered the run. Interactive (non-factory) sessions keep the existing user > org precedence, so personal plan subscriptions and keys still take priority there.
