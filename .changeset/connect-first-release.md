---
'@mastra/connect': minor
---

Added @mastra/connect, a new package that turns Mastra-platform integration connections into agent toolsets with zero credential handling. Tools execute through the platform connection proxy, so provider credentials never enter your app.

**Discover everything a project has connected**

```ts
import { Agent } from '@mastra/core/agent';
import { connect } from '@mastra/connect';

const agent = new Agent({
  // Live: resolved per generate/stream, uses MASTRA_PROJECT_ID.
  tools: connect(),
  model: 'openai/gpt-5-mini',
});
```

`connect()` returns a live resolver compatible with an agent's dynamic `tools` argument, backed by a TTL cache (stale-while-revalidate, default 30s, configurable via `ttlMs`). Integrations attached to — or detached from — the project on the platform are picked up (or dropped) by running agents without a server restart; `invalidate()` and `refresh()` give manual control, and calling the resolver directly (`await connect()()`) yields a plain toolsets record for an agent's `toolsets` option. Per-integration problems (needs re-auth, ambiguity, not attached yet) downgrade to warn-and-skip so one bad integration never takes down the whole toolset.

**Explicit per-provider toolsets for all nine platform integrations**

```ts
import { Agent } from '@mastra/core/agent';
import {
  createLinearTools,
  createNotionTools,
  createJiraTools,
  createSnowflakeTools,
  createGitlabTools,
  createNeonTools,
  createCloudflareTools,
  createResendTools,
  createAnthropicTools,
} from '@mastra/connect';

const agent = new Agent({
  name: 'ops',
  instructions: 'You manage our workspaces.',
  model: 'openai/gpt-5-mini',
  toolsets: {
    linear: createLinearTools({ allowTools: ['linear_search_issues', 'linear_list_issues'] }),
    notion: createNotionTools(),
    jira: createJiraTools(),
    snowflake: createSnowflakeTools(),
    gitlab: createGitlabTools(),
    neon: createNeonTools(),
    cloudflare: createCloudflareTools(),
    resend: createResendTools(),
    anthropic: createAnthropicTools(),
  },
});
```

Each builder accepts `connectionId`, `allowTools` (limit the agent to a subset of tools), and a `client` override; without `connectionId`, it falls back to `MASTRA_<PROVIDER>_CONNECTION_ID`.

**Fetch a raw credential for custom interactions**

```ts
import { credential } from '@mastra/connect';

const cred = await credential('c_...'); // { type: 'oauth2', accessToken, expiresAt } | { type: 'api_key', apiKey }
```
