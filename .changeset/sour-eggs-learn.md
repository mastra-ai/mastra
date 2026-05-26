---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/core': patch
'mastra': patch
---

Agent Builder action routes (`/agent-builder/*`) are now registered automatically through the standard server route pipeline. Any adapter built on `@mastra/server` (Hono, Express, Fastify, Koa, etc.) serves the 15 `/agent-builder/*` endpoints without consumers wiring them manually.

**Example**

```ts
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

// `/agent-builder/*` routes are now reachable out-of-the-box
const actions = await client.getAgentBuilderActions();

const action = client.getAgentBuilderAction('generate-agent');
const { runId } = await action.createRun();
const result = await action.startAsync({ inputData: { prompt: 'Build me an agent' } }, runId);
```

**Why**

Previously, `AGENT_BUILDER_ROUTES` was a type-only entry in the route registry to keep `@mastra/agent-builder` out of Cloudflare worker bundles. Consumers had to register the routes themselves to expose Agent Builder functionality. Lazy-loading of `@mastra/agent-builder` is preserved — handlers still resolve the workflow module on first request via dynamic `import()`, so Cloudflare bundles are unaffected.

**New EE permissions**

The following permissions are added to the EE registry. RBAC consumers with strict allowlists must grant these to retain access to builder action routes:

- `agent-builder:read`
- `agent-builder:write`
- `agent-builder:execute`

Two legacy stream routes (`STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE`, `OBSERVE_STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE`) are now registered through the standard pipeline as well.
