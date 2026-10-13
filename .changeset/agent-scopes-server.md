---
'@mastra/server': patch
---

Agent scopes support:

- Agent routes ignore `scopes` in request bodies (including `ifIdle.streamOptions.scopes`), and `mastra__scopes` is a reserved request context key.
- Set scopes from trusted server middleware instead:

  ```ts
  import { MASTRA_SCOPES_KEY } from '@mastra/core/request-context';

  server: {
    middleware: [async (c, next) => {
      c.get('requestContext').set(MASTRA_SCOPES_KEY, [`org:${orgIdFromAuth(c)}`]);
      await next();
    }],
  }
  ```

- A conflicting `resource:` or `thread:` scope returns a 400 error.
- With an older `@mastra/server` registered, agent calls that pass scopes — from the call or the request context — fail with `AGENT_SCOPES_SERVER_OUTDATED` (HTTP 400). Scopes configured on the agent itself still work. Upgrade the server to lift the restriction.
