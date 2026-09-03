---
'@mastra/connect': minor
---

Added @mastra/connect, a new package that turns Mastra-platform integration connections into agent toolsets with zero credential handling. Tools execute through the platform connection proxy, so provider credentials never enter your app.

**Discover everything a project has connected**

```ts
import { connect } from '@mastra/connect';

const toolsets = await connect(); // uses MASTRA_PROJECT_ID
const response = await agent.generate('Whats on my plate?', { toolsets });
```

**Fetch a raw credential for custom interactions**

```ts
import { credential } from '@mastra/connect';

const cred = await credential('c_...'); // { type: 'oauth2', accessToken, expiresAt } | { type: 'api_key', apiKey }
```

This release ships the package core: connect() runtime discovery, credential() retrieval, and the proxy-based tool infrastructure, including access limiting via allowTools and a connect() integration allowlist. Provider toolsets follow in subsequent releases.
