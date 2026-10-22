---
'@mastra/client-js': minor
---

Added typed business errors. When the server returns a business error, `error.code` holds its code and `error.metadata` the optional details, so you can handle specific failures without parsing messages.

`getServerError(error)` returns the server error as a plain `{ error, code, metadata }` object, typed as a union of every server error code. Narrowing on `code` types `metadata`. Pass the route of the call to narrow the union to the codes that route can return. It returns `undefined` for errors that didn't come from the server, such as network failures.

```ts
import { getServerError } from '@mastra/client-js';

try {
  await client.getAgent('support-agent').details();
} catch (error) {
  const serverError = getServerError(error, 'GET /agents/:agentId');
  if (serverError?.code === 'AGENT_NOT_FOUND') {
    console.error(`Unknown agent: ${serverError.metadata.agentId}`); // agentId: string
  } else {
    console.error(serverError?.error ?? 'Something went wrong');
  }
}
```

The `ServerError`, `ServerErrorCode`, `ServerErrorMetadataMap`, `RouteError` and `RouteErrorCode` types are also exported. Routes added with `registerApiRoute` can return their own codes, so keep a fallback branch.
