# Dual Auth System Demo

This demo shows how to configure separate authentication for your API (external customers) and Studio (internal team members).

## Why Dual Auth?

**The Problem:** Your Mastra server serves two different audiences:
- **External customers** who call your API with API keys or JWT tokens
- **Internal team members** who use Studio with corporate SSO

Before dual auth, you had to choose one auth provider for both, which meant either:
- Giving customers SSO access (security risk)
- Making team members use API keys (poor UX)
- Running two separate servers (operational complexity)

**The Solution:** Dual auth lets you configure `server.auth` for API requests and `studio.auth` for Studio requests.

---

## Demo Setup

### Prerequisites

1. A Mastra project (run `npx create-mastra@latest` if needed)
2. WorkOS account with SSO configured (for Studio auth)
3. 5 minutes

### Step 1: Configure Dual Auth

Update your `src/mastra/index.ts`:

```typescript
import { Mastra } from '@mastra/core'
import { SimpleAuth } from '@mastra/core/server'
import { StaticRBACProvider, DEFAULT_ROLES } from '@mastra/core/auth/ee'
import { MastraAuthWorkos } from '@mastra/auth-workos'

// Simple agent for testing
const testAgent = {
  id: 'test-agent',
  name: 'Test Agent',
  instructions: 'You are a helpful assistant.',
  model: { provider: 'openai', name: 'gpt-4o-mini' },
}

export const mastra = new Mastra({
  agents: { testAgent },
  
  server: {
    // API authentication - for external customers
    auth: new SimpleAuth({
      tokens: {
        'sk-customer-acme': {
          id: 'customer-1',
          name: 'Acme Corp',
          email: 'api@acme.com',
        },
        'sk-customer-globex': {
          id: 'customer-2', 
          name: 'Globex Inc',
          email: 'api@globex.com',
        },
      },
    }),
    rbac: new StaticRBACProvider({
      roles: {
        customer: ['agents:read', 'agents:execute'],
      },
      getUserRoles: () => ['customer'],
    }),
  },

  studio: {
    // Studio authentication - for internal team
    auth: new MastraAuthWorkos({
      clientId: process.env.WORKOS_CLIENT_ID!,
      apiKey: process.env.WORKOS_API_KEY!,
      redirectUri: process.env.WORKOS_REDIRECT_URI!,
      cookieSecret: process.env.WORKOS_COOKIE_SECRET!,
    }),
    rbac: new StaticRBACProvider({
      roles: DEFAULT_ROLES,
      getUserRoles: user => [user.role ?? 'admin'],
    }),
  },
})
```

### Step 2: Set Environment Variables

```bash
# .env
WORKOS_CLIENT_ID=client_xxx
WORKOS_API_KEY=sk_xxx
WORKOS_REDIRECT_URI=http://localhost:4111/api/auth/callback
WORKOS_COOKIE_SECRET=your-32-char-secret-here
OPENAI_API_KEY=sk-xxx
```

### Step 3: Start the Server

```bash
pnpm dev
```

---

## Demo Script

### Part 1: API Authentication (External Customers)

**Show:** Customers use API keys to access your agents.

```bash
# ✅ Valid API key - works
curl http://localhost:4111/api/agents \
  -H "Authorization: Bearer sk-customer-acme"

# Response: List of agents

# ✅ Execute agent with valid key
curl -X POST http://localhost:4111/api/agents/test-agent/generate \
  -H "Authorization: Bearer sk-customer-acme" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'

# Response: Agent response

# ❌ Invalid API key - rejected
curl http://localhost:4111/api/agents \
  -H "Authorization: Bearer invalid-key"

# Response: {"error": "Invalid or expired token"}

# ❌ No auth header - rejected
curl http://localhost:4111/api/agents

# Response: {"error": "Authorization header required"}
```

**Key point:** API requests use `server.auth` (SimpleAuth with API keys).

### Part 2: Studio Authentication (Internal Team)

**Show:** Team members use WorkOS SSO to access Studio.

1. Open http://localhost:4111 in your browser
2. You'll see a "Sign in with WorkOS" button (not an API key form)
3. Click to authenticate via your corporate SSO
4. After login, you're in Studio with full access

**Key point:** Studio requests use `studio.auth` (WorkOS SSO).

### Part 3: Different Permissions

**Show:** Customers have limited permissions, team members have full access.

**Customer (API key):**
```bash
# ✅ Can read agents
curl http://localhost:4111/api/agents \
  -H "Authorization: Bearer sk-customer-acme"

# ✅ Can execute agents  
curl -X POST http://localhost:4111/api/agents/test-agent/generate \
  -H "Authorization: Bearer sk-customer-acme" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'

# ❌ Cannot delete (permission denied)
curl -X DELETE http://localhost:4111/api/agents/test-agent \
  -H "Authorization: Bearer sk-customer-acme"

# Response: {"error": "Missing required permission: agents:delete"}
```

**Team member (Studio):**
- Can read, write, execute, AND delete agents
- Has access to workflows, memory, observability, etc.
- UI shows all actions (no hidden buttons)

### Part 4: Security - Header Spoofing Protection

**Show:** Spoofing the Studio header doesn't bypass auth.

```bash
# ❌ Spoofing the header doesn't help without valid credentials
curl http://localhost:4111/api/agents \
  -H "x-mastra-client-type: studio" \
  -H "Authorization: Bearer invalid-token"

# Response: {"error": "Invalid or expired token"}
```

The header only routes to the correct auth provider. You still need valid credentials.

---

## Benefits Summary

| Scenario | Before Dual Auth | After Dual Auth |
|----------|------------------|-----------------|
| Customer API access | Share SSO or run separate server | API keys via `server.auth` |
| Team Studio access | Use API keys or share customer auth | Corporate SSO via `studio.auth` |
| Permission separation | Complex role mapping | Separate RBAC per context |
| Security | Risk of cross-contamination | Clean isolation |

---

## Try It Yourself

1. Clone the example: `git clone https://github.com/mastra-ai/mastra && cd examples/dual-auth`
2. Copy `.env.example` to `.env` and fill in credentials
3. Run `pnpm dev`
4. Test API with curl commands above
5. Test Studio by opening http://localhost:4111

---

## Questions?

- **Slack:** #mastra-auth channel
- **Docs:** https://mastra.ai/docs/server/auth/dual-auth
- **GitHub:** https://github.com/mastra-ai/mastra/issues
