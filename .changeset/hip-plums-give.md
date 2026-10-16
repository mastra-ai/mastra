---
'@mastra/client-js': minor
---

Added `problem` to `MastraClientError`. When the server returns a business error, `error.problem` holds its `code` and optional `metadata`, so you can handle specific failures without parsing messages.

```ts
import { MastraClientError } from '@mastra/client-js';
import { SERVER_ERROR_CODES } from '@mastra/server/error-codes';

try {
  await client.getAgent('support-agent').details();
} catch (error) {
  if (error instanceof MastraClientError && error.problem?.code === SERVER_ERROR_CODES.AGENT_NOT_FOUND) {
    console.error(`Unknown agent: ${error.problem.metadata?.agentId}`);
  }
}
```
