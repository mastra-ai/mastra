---
'@mastra/auth-agentlair': minor
---

Added `@mastra/auth-agentlair` package for agent-to-agent authentication via [AgentLair](https://agentlair.dev). Verifies EdDSA-signed JWTs using JWKS, with optional behavioral trust-score gating and RBAC tier mapping.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthAgentLair } from '@mastra/auth-agentlair';

const mastra = new Mastra({
  server: {
    auth: new MastraAuthAgentLair({
      requiredTrustScore: 500,
    }),
  },
});
```
