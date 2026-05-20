---
'@mastra/core': minor
---

Preview: `@mastra/core/harness/v1` can now be imported for early migration work. It exposes the new `Harness` and `Session` entry points that will host the v1 Harness + Session split as the implementation lands.

```ts
import { Harness, Session } from '@mastra/core/harness/v1';
```

This v1 entry point is not production-ready yet; continue using `@mastra/core/harness` for stable Harness behavior until the follow-up migration PRs land.
