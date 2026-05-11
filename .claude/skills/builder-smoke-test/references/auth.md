# Auth Toggle

Test auth on/off behavior end-to-end. This section is the only place that
requires WorkOS env vars; every other section runs auth-off.

## Mode toggle

The skill defines two states and switches between them by editing
`examples/agent/.env`. There is **no** global on/off flag in code — auth on
is "AUTH_PROVIDER plus WorkOS creds present in `.env`," auth off is "those
lines absent or commented." `mastra dev` reads `.env` once at boot, so any
change requires a server restart.

### auth off (Prompts 1–6 default)

`examples/agent/.env` must have `AUTH_PROVIDER` commented or absent. The
three `WORKOS_*` vars may stay in `.env` — they're inert without
`AUTH_PROVIDER`. Confirm with:

```bash
bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect off
```

### auth on (Prompt 7)

`examples/agent/.env` must have all four:

```
AUTH_PROVIDER=workos
WORKOS_API_KEY=<key>
WORKOS_CLIENT_ID=<id>
WORKOS_ORGANIZATION_ID=<org-id>
```

Optional but commonly set: `WORKOS_REDIRECT_URI` (defaults to
`http://localhost:4111/api/auth/callback`), `WORKOS_COOKIE_PASSWORD`.

Confirm with:

```bash
bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect on
```

If preflight reports missing vars, surface that to the user — don't edit
`.env` without explicit consent. The user can either add the lines
themselves or dictate values for you to write.

### What FGA actually is

`MastraFGAWorkos` is the WorkOS-backed fine-grained authorization
provider. It's constructed in `examples/agent/src/mastra/auth/workos.ts`
and checks per-resource permissions ("can user X `:read` agent Y") against
the WorkOS organization named by `WORKOS_ORGANIZATION_ID`. FGA only fires
when (a) the route declares an `fga` block in its metadata AND (b) the
server has an FGA provider configured — which means `AUTH_PROVIDER=workos`.
There is no `MASTRA_FGA_ENABLED` env var anywhere in the codebase.

If FGA throws `FGADeniedError` during an auth-on run, the most likely
causes are: `WORKOS_ORGANIZATION_ID` doesn't match the org the FGA tuples
are stored under, or the logged-in user has no matching tuple. Report the
denial and the org/user combo; don't try to disable FGA — disabling it
without disabling WorkOS auth is not a supported configuration.

## Steps

### 1. Auth ON — verify login required

Ensure `--expect on` passes, restart `mastra dev` if you just edited `.env`.

```bash
curl -s -o /dev/null -w '%{http_code}' http://localhost:4111/api/stored/agents
```

- [ ] Returns 401 (not 200)
- [ ] Response body is JSON, not HTML or a stack trace

In the browser:

- [ ] Navigate to `http://localhost:4111/agent-builder`
- [ ] Redirected to WorkOS login
- [ ] After login, builder loads normally

### 2. Auth ON — verify authorId is set

After logging in, create an entity (use the browser session or copy the
session cookie into curl):

```bash
curl -s -X POST http://localhost:4111/api/stored/skills \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <session-cookie>' \
  -d '{"name": "Auth Test Skill", "workspaceId": "<workspaceId>"}' | jq '.authorId'
```

- [ ] `authorId` is a real user ID (not null or empty)

### 3. Auth ON → Auth OFF — switch mode

1. Comment out the `AUTH_PROVIDER=workos` line in `examples/agent/.env` (one
   `#` at the start of the line).
2. Restart `pnpm mastra:dev`.
3. Re-run preflight with the new expectation:

   ```bash
   bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect off
   ```

- [ ] Preflight reports detected mode `off`
- [ ] API returns 200 without a session:

  ```bash
  curl -s -o /dev/null -w '%{http_code}' http://localhost:4111/api/stored/agents
  ```

- [ ] In the browser, `/agent-builder` loads without a login prompt

### 4. Auth OFF — data persists

- [ ] Entities created during the auth-on phase still appear in the auth-off
      listings
- [ ] `authorId` on those entities is preserved (records from auth-on don't
      get rewritten)

### 5. Auth-not-configured bypass (#16107)

With `AUTH_PROVIDER` absent, ownership/role checks at the route layer
should be bypassed cleanly:

- [ ] Creating entities sets `authorId` to a stable default (or null)
      without error
- [ ] Reads / writes succeed without `X-Mastra-Role-Preview`
- [ ] Library page still surfaces public skills

### 6. Error handling

Re-enable auth (uncomment `AUTH_PROVIDER=workos`, restart). Make an
unauthenticated request:

```bash
curl -s http://localhost:4111/api/stored/agents | jq .
```

- [ ] Clear JSON error (401/403), not a server crash
- [ ] Error body is JSON-shaped, not HTML

## Notes

- Auth changes require a server restart — `mastra dev` only reads `.env` at
  boot.
- The WorkOS session cookie is httpOnly, so a Stagehand-style browser
  automation picks it up automatically.
- `authorId` on entities created without auth may be a system default or
  null — that's expected; don't fail the run on it.

## Checklist

- [ ] Preflight reports the expected mode before each phase of this section
- [ ] Auth ON: API returns 401 without session
- [ ] Auth ON: browser redirects to login
- [ ] Auth ON: `authorId` set on created entities
- [ ] Auth OFF: API accessible without auth
- [ ] Auth OFF: browser loads without login
- [ ] Auth ON → OFF: data persists, `authorId` preserved
- [ ] Unauthenticated requests return clean JSON errors
