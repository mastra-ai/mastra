---
'@mastra/core': patch
---

Fixed thread stream subscriptions so direct agent streams remain readable by callers, resumed runs can be tracked without confusing multiple stream lifetimes for the same run, and generic suspended tools remain discoverable without waking unrelated idle runs.
