# Dual Auth Example

This example demonstrates **separate authentication** for Studio and API:

- **Studio**: WorkOS SSO (Google OAuth, SAML, etc.) for your internal team
- **API**: JWT tokens for programmatic API access by external consumers

## Why Dual Auth?

This pattern is common in SaaS products:

| Access Point | Who Uses It | Auth Method |
|--------------|-------------|-------------|
| Studio UI | Your team members | SSO (Google, Okta, etc.) |
| API | Your customers' code | API keys / JWT tokens |

**Benefits:**
- Team members get seamless SSO login
- API consumers get simple token-based auth
- Different security policies for each access point
- Clear separation of internal vs external access

## Setup

### 1. Copy environment file

```bash
cp .env.example .env
```

### 2. Configure WorkOS (Studio Auth)

1. Go to [WorkOS Dashboard](https://dashboard.workos.com)
2. Create an application or use an existing one
3. Copy your Client ID and API Key to `.env`
4. Add redirect URI: `http://localhost:4111/api/auth/sso/callback`

### 3. Configure JWT (Server Auth)

Set a secret for JWT token verification:

```env
JWT_SECRET=your-secret-key-here
```

### 4. Add OpenAI API Key

```env
OPENAI_API_KEY=sk-xxx
```

### 5. Install and run

```bash
pnpm install
pnpm mastra:dev
```

## Testing

### Studio Login (WorkOS SSO)

1. Open http://localhost:4111
2. Click "Sign in" - you'll be redirected to WorkOS/Google
3. Complete SSO login
4. You'll be redirected back to Studio

### API Access (JWT)

Generate a test JWT token and call the API:

```bash
# Simple test token (don't use in production!)
TOKEN=$(node -e "
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({sub:'user-1',email:'test@example.com',name:'Test User',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
console.log(header + '.' + payload + '.fake-signature');
")

# Call API with token
curl -H "Authorization: Bearer $TOKEN" http://localhost:4111/api/agents
```

## How It Works

```typescript
export const mastra = new Mastra({
  // API: JWT tokens for external consumers
  server: {
    auth: {
      authenticateToken: async (token) => {
        // Verify JWT and return user
      },
    },
  },
  // Studio: WorkOS SSO for internal team
  studio: {
    auth: new MastraAuthWorkos({
      clientId: process.env.WORKOS_CLIENT_ID,
      apiKey: process.env.WORKOS_API_KEY,
      // ...
    }),
  },
});
```

The routing happens automatically based on the request:
- Requests with `x-mastra-client-type: studio` header → Studio auth
- API requests with `Authorization: Bearer xxx` → Server auth
