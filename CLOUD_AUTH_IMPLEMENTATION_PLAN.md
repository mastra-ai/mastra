# Cloud Auth Implementation Plan for @mastra/core

## Context

Mastra Cloud has implemented OSS Auth endpoints that allow users of local/self-hosted Mastra apps to authenticate against Mastra Cloud. The business-api endpoints are complete:
- `POST /api/v1/auth/oss` - Initiate OAuth flow
- `POST /api/v1/auth/callback` - Exchange code for token
- `POST /api/v1/auth/verify` - Verify token and get user info

The `@mastra/auth-cloud` package (`auth/cloud/src/`) is also complete with:
- `MastraCloudAuthProvider` - Full auth provider implementation
- `MastraCloudAuth` client - OAuth client with PKCE support

## Goal

Enable deployed Mastra Cloud runners to use cloud auth for end users by:
1. Updating `CompositeAuth` to delegate all auth interface methods
2. Updating the cloud deployer to inject `MastraCloudAuthProvider`

## Architecture After Implementation

```
CompositeAuth([
  SimpleAuth,              ← Service tokens (BUSINESS_JWT, PLAYGROUND_JWT)
  MastraCloudAuthProvider, ← Cloud user auth (calls /auth/verify)
  UserDefinedAuth?,        ← User's custom auth (if configured)
])

Request → authenticateToken() → First provider to return user wins
       → getLoginUrl()        → First ISSOProvider wins
       → handleCallback()     → First ISSOProvider wins
       → validateSession()    → First ISessionProvider wins
```

---

## Task 1: Update CompositeAuth

**File:** `packages/core/src/server/auth/composite-auth.ts` (find exact location)

**Current State:** Only delegates `authenticateToken()` and `authorizeUser()`

**Required Changes:** Add delegation for all auth interfaces

### Interfaces to Support

```typescript
// From packages/core/src/auth/types.ts (find exact location)
interface ISSOProvider<U = EEUser> {
  getLoginUrl(redirectUri: string, state: string): string;
  getLoginCookies?(): string[] | undefined;
  handleCallback(code: string, state: string): Promise<SSOCallbackResult<U>>;
  getLoginButtonConfig(): SSOLoginConfig;
  getLogoutUrl?(redirectUri: string, request?: Request): string | null;
}

interface ISessionProvider<S = Session> {
  createSession(userId: string, metadata?: Record<string, unknown>): Promise<S>;
  validateSession(sessionId: string): Promise<S | null>;
  destroySession(sessionId: string): Promise<void>;
  refreshSession(sessionId: string): Promise<S | null>;
  getSessionIdFromRequest(request: Request): string | null;
  getSessionHeaders(session: S): Record<string, string>;
  getClearSessionHeaders(): Record<string, string>;
}

interface IUserProvider<U = EEUser> {
  getCurrentUser(request: Request): Promise<U | null>;
  getUser(userId: string): Promise<U | null>;
}
```

### Implementation Pattern

```typescript
import type { ISSOProvider, ISessionProvider, IUserProvider } from '@mastra/core/auth';

// Type guards for interface detection
function isSSOProvider(p: unknown): p is ISSOProvider {
  return p !== null && typeof p === 'object' && 'getLoginUrl' in p && 'handleCallback' in p;
}

function isSessionProvider(p: unknown): p is ISessionProvider {
  return p !== null && typeof p === 'object' && 'validateSession' in p && 'createSession' in p;
}

function isUserProvider(p: unknown): p is IUserProvider {
  return p !== null && typeof p === 'object' && 'getCurrentUser' in p;
}

export class CompositeAuth extends MastraAuthProvider
  implements ISSOProvider, ISessionProvider, IUserProvider {

  private providers: MastraAuthProvider[];

  constructor(providers: MastraAuthProvider[]) {
    super();
    this.providers = providers;
  }

  // Find first provider implementing an interface
  private findProvider<T>(check: (p: unknown) => p is T): T | undefined {
    return this.providers.find(check) as T | undefined;
  }

  // Existing: authenticateToken - try each provider until one returns a user
  async authenticateToken(token: string, request: Request): Promise<User | null> {
    for (const provider of this.providers) {
      const user = await provider.authenticateToken(token, request);
      if (user) return user;
    }
    return null;
  }

  // Existing: authorizeUser - all providers must authorize
  authorizeUser(user: User): boolean {
    return this.providers.every(p => p.authorizeUser(user));
  }

  // NEW: ISSOProvider delegation
  getLoginUrl(redirectUri: string, state: string): string {
    const sso = this.findProvider(isSSOProvider);
    if (!sso) throw new Error('No SSO provider configured in CompositeAuth');
    return sso.getLoginUrl(redirectUri, state);
  }

  getLoginCookies(): string[] | undefined {
    const sso = this.findProvider(isSSOProvider);
    return sso?.getLoginCookies?.();
  }

  async handleCallback(code: string, state: string): Promise<SSOCallbackResult> {
    const sso = this.findProvider(isSSOProvider);
    if (!sso) throw new Error('No SSO provider configured in CompositeAuth');
    return sso.handleCallback(code, state);
  }

  getLoginButtonConfig(): SSOLoginConfig {
    const sso = this.findProvider(isSSOProvider);
    if (!sso) return { provider: 'unknown', text: 'Sign in' };
    return sso.getLoginButtonConfig();
  }

  getLogoutUrl(redirectUri: string, request?: Request): string | null {
    const sso = this.findProvider(isSSOProvider);
    return sso?.getLogoutUrl?.(redirectUri, request) ?? null;
  }

  // NEW: ISessionProvider delegation
  async createSession(userId: string, metadata?: Record<string, unknown>): Promise<Session> {
    const session = this.findProvider(isSessionProvider);
    if (!session) throw new Error('No session provider configured in CompositeAuth');
    return session.createSession(userId, metadata);
  }

  async validateSession(sessionId: string): Promise<Session | null> {
    const session = this.findProvider(isSessionProvider);
    if (!session) return null;
    return session.validateSession(sessionId);
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.findProvider(isSessionProvider);
    if (session) await session.destroySession(sessionId);
  }

  async refreshSession(sessionId: string): Promise<Session | null> {
    const session = this.findProvider(isSessionProvider);
    if (!session) return null;
    return session.refreshSession(sessionId);
  }

  getSessionIdFromRequest(request: Request): string | null {
    const session = this.findProvider(isSessionProvider);
    return session?.getSessionIdFromRequest(request) ?? null;
  }

  getSessionHeaders(session: Session): Record<string, string> {
    const sessionProvider = this.findProvider(isSessionProvider);
    return sessionProvider?.getSessionHeaders(session) ?? {};
  }

  getClearSessionHeaders(): Record<string, string> {
    const session = this.findProvider(isSessionProvider);
    return session?.getClearSessionHeaders() ?? {};
  }

  // NEW: IUserProvider delegation
  async getCurrentUser(request: Request): Promise<User | null> {
    const user = this.findProvider(isUserProvider);
    if (!user) return null;
    return user.getCurrentUser(request);
  }

  async getUser(userId: string): Promise<User | null> {
    const user = this.findProvider(isUserProvider);
    if (!user) return null;
    return user.getUser(userId);
  }
}
```

---

## Task 2: Update Cloud Deployer Auth Injection

**File:** `deployers/cloud/src/utils/auth.ts`

**Current State:** Only injects SimpleAuth for service tokens

**Required Changes:** Also inject MastraCloudAuthProvider for user auth

### Current Code

```typescript
export function getAuthEntrypoint() {
  const tokensObject: Record<string, { id: string }> = {};
  // ... token setup ...

  return `
  import { SimpleAuth, CompositeAuth } from '@mastra/core/server';

  class MastraCloudAuth extends SimpleAuth {
    constructor() {
      super({ tokens: ${JSON.stringify(tokensObject)} });
    }
    // ... authorizeUser override ...
  }

  const serverConfig = mastra.getServer()
  if (serverConfig && serverConfig.auth) {
    const existingAuth = serverConfig.auth
    const cloudAuth = new MastraCloudAuth()
    serverConfig.auth = new CompositeAuth([cloudAuth, existingAuth])
  }
  `;
}
```

### Updated Code

```typescript
export function getAuthEntrypoint() {
  const tokensObject: Record<string, { id: string }> = {};

  if (process.env.PLAYGROUND_JWT_TOKEN) {
    tokensObject[process.env.PLAYGROUND_JWT_TOKEN] = { id: 'business-api' };
  }
  if (process.env.BUSINESS_JWT_TOKEN) {
    tokensObject[process.env.BUSINESS_JWT_TOKEN] = { id: 'business-api' };
  }

  return `
  import { SimpleAuth, CompositeAuth } from '@mastra/core/server';
  import { MastraCloudAuthProvider } from '@mastra/auth-cloud';

  // Service token auth (for business-api, playground internal calls)
  const serviceAuth = new SimpleAuth({
    tokens: ${JSON.stringify(tokensObject)},
  });

  // Cloud user auth (for end users via OAuth)
  // Only enabled if MASTRA_CLOUD_API_URL is set
  let cloudUserAuth = null;
  if (process.env.MASTRA_CLOUD_API_URL) {
    cloudUserAuth = new MastraCloudAuthProvider({
      projectId: process.env.PROJECT_ID,
      cloudBaseUrl: process.env.MASTRA_CLOUD_API_URL,
      callbackUrl: process.env.MASTRA_CLOUD_CALLBACK_URL || \`\${process.env.MASTRA_CLOUD_API_URL}/auth/callback\`,
    });
  }

  const serverConfig = mastra.getServer();
  const userAuth = serverConfig?.auth;

  // Build provider list: service auth first, then cloud user auth, then user's custom auth
  const providers = [serviceAuth];
  if (cloudUserAuth) {
    providers.push(cloudUserAuth);
  }
  if (userAuth) {
    providers.push(userAuth);
  }

  // Always use CompositeAuth to combine providers
  serverConfig.auth = new CompositeAuth(providers);
  `;
}
```

### Add @mastra/auth-cloud Dependency

**File:** `deployers/cloud/package.json`

Add `@mastra/auth-cloud` as a dependency so the import works in the bundled entry point.

---

## Task 3: Ensure @mastra/auth-cloud is Bundled

The deployer needs to ensure `@mastra/auth-cloud` is available in the bundled output.

**File:** `deployers/cloud/src/index.ts` (or wherever dependencies are added)

Check how other cloud packages like `@mastra/loggers` and `@mastra/libsql` are bundled and follow the same pattern for `@mastra/auth-cloud`.

---

## Environment Variables (for reference)

These will be provided by mastra-cloud's platform-api:

| Variable | Value | Purpose |
|----------|-------|---------|
| `PROJECT_ID` | Already set | Project identifier |
| `MASTRA_CLOUD_API_URL` | `https://cloud.mastra.ai` | Cloud API base URL |
| `MASTRA_CLOUD_CALLBACK_URL` | `{runnerUrl}/auth/callback` | OAuth callback URL |
| `BUSINESS_JWT_TOKEN` | Generated per runner | Service token |
| `PLAYGROUND_JWT_TOKEN` | Generated per runner | Playground token |

---

## Testing

1. **Unit Tests for CompositeAuth:**
   - Test that interface methods delegate to correct provider
   - Test that first implementing provider is used
   - Test error handling when no provider implements interface

2. **Integration Test for Deployer:**
   - Build a test project with cloud deployer
   - Verify entry point includes MastraCloudAuthProvider
   - Verify CompositeAuth is constructed correctly

---

## Order of Implementation

1. Update CompositeAuth (packages/core)
2. Add auth-cloud dependency to deployer (deployers/cloud)
3. Update getAuthEntrypoint (deployers/cloud)
4. Test locally
5. Publish new versions

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/core/src/server/auth/composite-auth.ts` | Add interface delegation |
| `deployers/cloud/src/utils/auth.ts` | Inject MastraCloudAuthProvider |
| `deployers/cloud/package.json` | Add @mastra/auth-cloud dependency |

## Files for Reference (already complete)

| File | Description |
|------|-------------|
| `auth/cloud/src/auth-provider.ts` | MastraCloudAuthProvider implementation |
| `auth/cloud/src/client.ts` | MastraCloudAuth client |
| `auth/cloud/src/oauth/` | OAuth flow implementation |
| `auth/cloud/src/session/` | Session management |
