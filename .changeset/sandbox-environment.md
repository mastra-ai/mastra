---
'@mastra/connect': minor
---

Add `environment()` for sandboxed agents. Materialize provider credentials from your project's Platform connections into a `{ env, onStart }` pair that any sandbox provider (e2b, Modal, Daytona, Docker, subprocess) can consume — so CLI tooling inside the sandbox is authenticated without hand-wiring tokens per agent.

```ts
import { environment } from '@mastra/connect';

const env = environment({
  projectId: process.env.MASTRA_PROJECT_ID,
  client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
});

const { env: envVars, onStart } = await env();

await sandbox.start({ env: envVars, onStart });
```

`environment()` shares its resolution model with `connect()`: same `projectId`, `client`, and per-provider `integrations` overrides (`connectionId` to pin, `disabled: true` to exclude). GitHub is the first provider with an env contributor — its OAuth token is exported as `GH_TOKEN`/`GITHUB_TOKEN` so both `gh` and `git` HTTPS authenticate as the connected user, and `onStart` installs a git credential helper that reads the token from the environment rather than baking it into git config.
