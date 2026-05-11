# Auth Toggle

Test auth on/off behavior. This section requires WorkOS environment variables.

## Prerequisites

The following env vars must be set in `examples/agent/.env`:

```
WORKOS_CLIENT_ID=<your-client-id>
WORKOS_API_KEY=<your-api-key>
WORKOS_ORGANIZATION_ID=<your-org-id>
```

If these are not available, **skip this section** and mark as ⏭️.

## Background

Auth is controlled by the `server.auth` config in the Mastra constructor. When auth is enabled:
- All API endpoints require a valid session
- The browser redirects to WorkOS login
- The session provides `authorId` for created entities

When auth is disabled:
- All endpoints are accessible without auth
- A default/anonymous `authorId` may be used

## Steps

### 1. Auth ON — Verify Login Required

Ensure the `server: { auth, rbac }` block is uncommented in `examples/agent/src/mastra/index.ts`. Restart the server.

```bash
# API should return 401 or redirect
curl -s -o /dev/null -w '%{http_code}' http://localhost:4111/api/stored/agents
```

- [ ] Returns 401 or 403 (not 200)

In the browser:

- [ ] Navigate to `http://localhost:4111/agent-builder`
- [ ] Redirected to login page (WorkOS/Google SSO)
- [ ] After login, builder loads normally

### 2. Auth ON — Verify authorId Set

After logging in, create an entity:

```bash
# Include the session cookie or auth header from the browser
curl -s -X POST http://localhost:4111/api/stored/skills \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <session-cookie>' \
  -d '{"name": "Auth Test Skill", "workspaceId": "<workspaceId>"}' | jq '.authorId'
```

- [ ] `authorId` is a real user ID (not null or empty)

### 3. Auth OFF — Verify No Login Required

Comment out the `server: { auth, rbac }` block in `examples/agent/src/mastra/index.ts`. Restart the server.

```bash
curl -s -o /dev/null -w '%{http_code}' http://localhost:4111/api/stored/agents
```

- [ ] Returns 200 (no auth required)

In the browser:

- [ ] Navigate to `http://localhost:4111/agent-builder`
- [ ] Builder loads directly, no login prompt
- [ ] Can create skills and agents without auth

### 4. Auth OFF → Auth ON — Session Persistence

Re-enable auth, restart server.

- [ ] Previously created entities still exist (data persists)
- [ ] Browser requires re-login
- [ ] After login, entities are accessible

### 5. Auth Error Handling

With auth enabled, make an unauthenticated request:

```bash
curl -s http://localhost:4111/api/stored/agents | jq .
```

- [ ] Returns a clear error (401/403), not a server crash
- [ ] Error message is JSON, not HTML or stack trace

## FGA workaround

`AUTH_PROVIDER=workos` auto-enables FGA, which throws `FGADeniedError` on tool execution against the example agent. For a non-auth smoke run (or for an auth-on run that doesn't need FGA), opt out by setting:

```
MASTRA_FGA_ENABLED=false
```

in `examples/agent/.env`, then restart. Verify:

```bash
# Tool execution from a builder agent should succeed without FGADeniedError
curl -s -X POST "$BASE/agents/builderAgent/stream" \
  -H 'Content-Type: application/json' \
  -d '{ "messages":[{"role":"user","content":"List my agents"}] }' | head -200
```

- [ ] Stream returns without `FGADeniedError`
- [ ] Tool call results appear in the stream

## Auth-not-configured bypass (#16107)

When `server.auth` is undefined, ownership/role checks should be bypassed at the route layer:

- [ ] Creating entities sets `authorId` to a stable default (or null) without error
- [ ] Reads / writes succeed without `X-Mastra-Role-Preview`
- [ ] Library page still surfaces public skills

## Notes

- Auth changes require server restart (config is read at init)
- The WorkOS session cookie is httpOnly, so browser automation gets it automatically
- `authorId` on entities created without auth may be a system default or null — this is expected

## Checklist

- [ ] Auth ON: API returns 401 without session
- [ ] Auth ON: Browser redirects to login
- [ ] Auth ON: authorId set on created entities
- [ ] Auth OFF: API accessible without auth
- [ ] Auth OFF: Browser loads without login
- [ ] Auth OFF → ON: Data persists, re-login required
- [ ] Unauthenticated requests return clean errors
