---
'@mastra/client-js': minor
---

Added the `@mastra/client-js/workflows` entrypoint for workflow clients in Expo and React Native applications.

```ts
import { createWorkflowClient } from '@mastra/client-js/workflows';

const client = createWorkflowClient({ baseUrl: 'https://example.com' });
const workflow = client.getWorkflow('campaign-workflow');
```
