---
'@mastra/core': patch
---

Fixed thread stream subscriptions so direct agent streams remain readable by callers and resumed runs can be tracked without confusing multiple stream lifetimes for the same run.
