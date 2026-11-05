---
'@mastra/mcp': patch
---

Fixed MCP tool calls running twice on the server after a dropped connection (#28415).

When the connection fails after a tool call was sent, the server may already have run it. The client now handles this case as follows:

- Tools the server marks `readOnlyHint` or `idempotentHint` are retried once, as before.
- Other tools fail with `MCP_CLIENT_TOOL_CALL_OUTCOME_UNKNOWN` and are not sent again. This includes a request sent on a connection the server had just closed, which used to be retried silently.
- Other calls running on the same server are no longer aborted and resent.
- Calls that never reached the server, such as a refused connection, still reconnect and retry.

Check the server state before retrying a call that failed this way:

```ts
import { MastraError } from '@mastra/core/error';

try {
  await tools.createTicket.execute(input);
} catch (error) {
  if (error instanceof MastraError && error.id === 'MCP_CLIENT_TOOL_CALL_OUTCOME_UNKNOWN') {
    // The ticket may exist. Look it up before creating it again.
  }
}
```
