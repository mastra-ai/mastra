---
'@mastra/core': patch
---

Fixed DurableAgent and EventedAgent treating falsy primitive resume payloads (`false`, `0`, `''`) as "no resume data" in the durable tool-call step. Suspended background tool tasks resumed with a falsy payload were stranded while a duplicate task was dispatched. The durable loop now uses the same nullish check as the regular agent loop (#22363), so only `undefined`/`null` mean "not resuming".
