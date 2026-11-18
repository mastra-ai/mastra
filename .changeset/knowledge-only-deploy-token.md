---
'@mastra/platform': patch
---

`PlatformKnowledge` now reads `MASTRA_KNOWLEDGE_ACCESS_TOKEN` when it is set, ahead of `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PLATFORM_SECRET_KEY`. An explicit `accessToken` option still wins. An empty `MASTRA_KNOWLEDGE_ACCESS_TOKEN` is ignored. This is a Knowledge-only credential, so an app can authenticate to Knowledge without the general Platform token.

Set the credential and instance ID in your environment:

```sh
export MASTRA_KNOWLEDGE_ACCESS_TOKEN='your-knowledge-token'
export MASTRA_KNOWLEDGE_INSTANCE_ID='your-knowledge-instance-id'
```

```ts
import { PlatformKnowledge } from '@mastra/platform';

const knowledge = new PlatformKnowledge();
```
