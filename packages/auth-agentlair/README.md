# @mastra/auth-agentlair

AgentLair auth provider for Mastra — EdDSA JWT verification and behavioral trust scoring for AI agents.

## Installation

```bash
pnpm add @mastra/auth-agentlair
```

## Usage

```typescript
import { MastraAgentLairAuth } from '@mastra/auth-agentlair';
import { Mastra } from '@mastra/core';

const auth = new MastraAgentLairAuth({
  audience: 'https://my-service.com',
  apiKey: process.env.AGENTLAIR_API_KEY,
  fetchTrustScore: true,
  minimumTrustScore: 500,
});

const mastra = new Mastra({
  server: {
    authProvider: auth,
  },
});
```

## How It Works

[AgentLair](https://agentlair.dev) provides verifiable identity and behavioral trust scoring for AI agents. Agents authenticate using EdDSA-signed JWTs (Agent Authentication Tokens) that are verified against AgentLair's JWKS endpoint.

This provider extends Mastra's `MastraAuthProvider` to:

1. **Verify agent identity** — EdDSA/Ed25519 JWT signature verification via JWKS
2. **Enforce trust-based authorization** — Behavioral trust scores (0-1000) as a permission layer
3. **Integrate with Mastra Studio** — Implements `IUserProvider` for agent awareness in the Studio UI

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | AgentLair API key for trust score lookups |
| `audience` | `string` | — | Expected JWT audience claim |
| `issuer` | `string` | `https://agentlair.dev` | Expected JWT issuer |
| `fetchTrustScore` | `boolean` | `false` | Fetch trust scores during authentication |
| `minimumTrustScore` | `number` | `0` | Minimum score required for authorization |
| `requiredTier` | `string` | — | Required trust tier (`untrusted`, `provisional`, `trusted`, `verified`) |
| `requiredScopes` | `string[]` | — | Required agent scopes (all must match) |

## License

Apache-2.0
