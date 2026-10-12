---
'@mastra/core': patch
---

Fixed durable workflow steps inside `dountil`/`dowhile` loops and `foreach` reusing one operation ID for every iteration. Replaying engines such as `@mastra/inngest` memoize by that ID, so later iterations returned the first iteration's result or were rejected as duplicates and long loops stalled. Each iteration past the first and each foreach item past index 0 now gets its own step and step-update operation IDs; the first keeps today's IDs so runs already in flight resume unchanged.
