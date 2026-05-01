# @mastra/auth-agentlair

A Mastra auth provider for [AgentLair](https://agentlair.dev) agent identity tokens. Verifies EdDSA-signed JWTs issued to autonomous agents, with optional trust-score gating and RBAC role mapping.

## Requirements

- Node.js 22.13.0 or later
- Agents authenticated via AgentLair (tokens issued at agentlair.dev)

## Installation

```bash
npm install @mastra/auth-agentlair
# or
pnpm add @mastra/auth-agentlair
```

## Quick start

```typescript
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthAgentLair } from '@mastra/auth-agentlair';

const mastra = new Mastra({
  server: {
    auth: new MastraAuthAgentLair({
      requiredTrustScore: 500, // reject agents scoring below 500
    }),
  },
});
```

Or with zero config (uses the default JWKS endpoint, no trust-score gate):

```typescript
const mastra = new Mastra({
  server: {
    auth: new MastraAuthAgentLair(),
  },
});
```

## Configuration

### Constructor options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `jwksUrl` | `string` | `https://agentlair.dev/.well-known/jwks.json` | JWKS endpoint for key fetching |
| `issuer` | `string` | (none) | Expected `iss` claim. Omit to skip issuer check |
| `requiredTrustScore` | `number` | `0` | Minimum behavioral trust score (0-1000) |

No environment variables are required. All configuration is passed via the constructor.

## Verified user payload

After successful authentication, you get an `AgentLairUser`:

```typescript
interface AgentLairUser {
  agentId: string;       // JWT sub claim
  iss: string;           // token issuer
  trustScore?: number;   // 0-1000, behavioral trust
  behavioralHealthScore?: number;
  claims: Record<string, unknown>;
}
```

## Trust-tiered RBAC

Map trust scores to roles and permissions:

```typescript
import { MastraAuthAgentLair, MastraRBACAgentLair } from '@mastra/auth-agentlair';

const auth = new MastraAuthAgentLair();

const rbac = new MastraRBACAgentLair({
  tierMapping: {
    'agent:untrusted': { minScore: 0, permissions: ['agents:read'] },
    'agent:verified':  { minScore: 500, permissions: ['agents:read', 'agents:execute'] },
    'agent:trusted':   { minScore: 800, permissions: ['agents:*', 'workflows:*', 'memory:read'] },
  },
});

// An agent with score 750 earns 'agent:untrusted' + 'agent:verified'
const roles = await rbac.getRoles(user);
const canExecute = await rbac.hasPermission(user, 'agents:execute'); // true
```

## How it works

The provider fetches AgentLair's public keys via JWKS, verifies the EdDSA signature on the Bearer token, and returns an `AgentLairUser` with the `sub` as `agentId` and any trust scores from the payload. If `requiredTrustScore` is set, `authorizeUser` rejects agents below that threshold. `MastraRBACAgentLair` optionally maps scores to role tiers for access control.

## API reference

### `MastraAuthAgentLair`

Extends `MastraAuthProvider<AgentLairUser>`.

- `authenticateToken(token: string)`: verifies the JWT, returns `AgentLairUser | null`.
- `authorizeUser(user: AgentLairUser)`: checks trust score threshold. Override via constructor option.

### `MastraRBACAgentLair`

- `getRoles(user)`: all roles the agent qualifies for.
- `hasRole(user, role)`: check a specific role.
- `getPermissions(user)`: union of permissions from all qualifying tiers.
- `hasPermission(user, permission)`: check a specific permission (supports `*` wildcards).

## Provenance

This adapter was written by Pico, an autonomous agent built on Claude and the PicoClaw runtime. Pico operates with persistent workspace memory across ephemeral containers, under a system prompt that fits in about 200 lines.

AgentLair is the identity and attestation layer that Pico uses to authenticate itself to external systems. The `trust_score` in the verified payload is the same primitive the runtime uses for self-calibration. What this package exposes to Mastra users is an internal feedback loop turned into a public interface.

More about Pico: [agentlair.dev](https://agentlair.dev)
