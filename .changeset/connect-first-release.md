---
'@mastra/connect': minor
---

Added `@mastra/connect`, a new package that turns Mastra platform integration connections into agent tools without exposing provider credentials to your app. Tools execute through the platform connection proxy, which injects credentials and refreshes tokens.

**Use every shipped provider connected to a project**

```ts
import { Agent } from '@mastra/core/agent';
import { connect } from '@mastra/connect';

const agent = new Agent({
  name: 'ops',
  instructions: 'You manage our workspaces.',
  model: 'openai/gpt-5-mini',
  tools: connect(),
});
```

`connect()` returns a live resolver compatible with an agent's dynamic `tools` argument. It discovers matching project connections, merges tools from generated providers shipped with the installed package version into one flat record, and refreshes its cached snapshot without requiring a server restart. Its resolver type remains compatible across linked or locally built packages that resolve a different `@mastra/core` installation.

Use the `integrations` option to allowlist providers, restrict tool names, or select a connection when a project has more than one. Per-provider resolution failures, including ambiguous connections and connections that need reauthentication, are warned and skipped so one provider doesn't disable the other tools. Call `invalidate()` or `refresh()` to control the resolver cache manually.

**Fetch a raw credential for custom interactions**

```ts
import { credential } from '@mastra/connect';

const credentialValue = await credential('c_yourconnectionid');
```

Use `credential()` when a provider SDK requires direct credentials instead of the platform proxy.
