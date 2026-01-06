---
'@mastra/inngest': patch
'@mastra/core': patch
---

Refactored default engine to fit durable execution better, and the inngest engine to match.
Also fixes requestContext persistence by relying on inngest step memoization.

Unifies some of the stepResults and error formats in both engines.
