---
'@mastra/github-signals': minor
---

Added intent-aware GitHub pull request subscription modes. Review mode follows code revisions, authorized comments, review-thread state, and terminal PR state without CI or mergeability noise, while omitted modes retain working behavior.

```ts
await githubSignals.subscribeThreadToPR({ threadId, resourceId, pr, mode: 'review' });
```
