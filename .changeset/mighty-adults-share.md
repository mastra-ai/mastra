---
'@mastra/server': patch
'@mastra/client-js': patch
---

Added an optional `notScorable` field on experiment item score results so clients can tell a skipped run apart from a scorer error.

```ts
for (const score of item.scores) {
  if (score.notScorable) {
    // skipped — score and error are null
  } else if (score.error) {
    // scorer failed
  } else {
    // score.score is a number
  }
}
```
