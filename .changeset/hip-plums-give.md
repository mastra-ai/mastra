---
'@mastra/client-js': minor
---

Added `code` and `metadata` to `MastraClientError`. When the server returns a business error, `error.code` holds its code and `error.metadata` the optional details, so you can handle specific failures without parsing messages.

```ts
import { MastraClientError } from '@mastra/client-js';
import { SERVER_ERROR_CODES } from '@mastra/server/error-codes';

try {
  await client.getAgent('support-agent').details();
} catch (error) {
  if (error instanceof MastraClientError && error.code === SERVER_ERROR_CODES.AGENT_NOT_FOUND) {
    console.error(`Unknown agent: ${error.metadata?.agentId}`);
  }
}
```
