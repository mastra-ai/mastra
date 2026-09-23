---
'@mastra/memory': patch
'@mastra/opencode': patch
---

Thread-scoped Observational Memory now describes observations as memory of the current conversation instead of "past conversations with this user". Agents using the default `scope: 'thread'` will reuse IDs, artifacts, and tool results recorded in observations instead of treating them as coming from a different session. Resource scope keeps its existing wording. Added `getObservationContextPrompt(scope)` for integrations that build the observations context themselves.

```ts
import { getObservationContextPrompt } from '@mastra/memory/processors';

const preamble = getObservationContextPrompt('thread');
// "The following observations block contains your memory of earlier parts of this current conversation. ..."
```
