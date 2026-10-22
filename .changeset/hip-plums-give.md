---
'@mastra/client-js': minor
---

Added typed business errors to `MastraClientError`. When the server returns a business error, `error.code` holds its code and `error.metadata` the optional details, so you can handle specific failures without parsing messages.

Use `isRouteError` to narrow an error to the codes a given route can return. Switching on `error.code` then types `error.metadata` for each code, with autocomplete:

```ts
import { isRouteError } from '@mastra/client-js';

try {
  await client.getAgent('support-agent').details();
} catch (error) {
  if (isRouteError(error, 'GET /agents/:agentId')) {
    switch (error.code) {
      case 'AGENT_NOT_FOUND':
        console.error(`Unknown agent: ${error.metadata.agentId}`); // agentId: string
        break;
      case 'AUTHENTICATION_REQUIRED':
        redirectToLogin();
        break;
      default:
        console.error(error.message);
    }
  }
}
```

To handle many codes in one place, use `matchRouteError` (or `matchServerError` for the whole catalog). Each handler gets the error with its typed `metadata`. Without `default`, every code the route can return must be handled; with it, unhandled codes and non-server errors such as network failures go to `default`. Errors nothing handles are rethrown.

```ts
import { matchRouteError } from '@mastra/client-js';

const message = matchRouteError(error, 'GET /agents/:agentId', {
  AGENT_NOT_FOUND: e => `Unknown agent ${e.metadata.agentId}`,
  AUTHENTICATION_REQUIRED: () => 'Please sign in',
  default: () => 'Something went wrong',
});
```

`isServerError` narrows to every code in the server catalog. The `ServerError`, `ServerErrorCode`, `ServerErrorMetadataMap`, `RouteError` and `RouteErrorCode` types are also exported. Routes added with `registerApiRoute` can return their own codes, so keep a `default` branch.
