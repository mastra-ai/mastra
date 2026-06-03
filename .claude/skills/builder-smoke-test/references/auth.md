# Auth Toggle

Test auth on/off behavior end-to-end. This section is the only place that
requires WorkOS env vars; every other section runs auth-off.

## Mode toggle

The skill defines two states and switches between them by editing
`$PROJECT_DIR/.env` (the scaffolded project). There is **no** global on/off flag in code — auth on
is "AUTH_PROVIDER plus WorkOS creds present in `.env`," auth off is "those
lines absent or commented." `mastra dev` reads `.env` once at boot, so any
change requires a server restart.

### auth off (Prompt 1 default)

`$PROJECT_DIR/.env` must have `AUTH_PROVIDER` commented or absent. The
three `WORKOS_*` vars may stay in `.env` — they're inert without
`AUTH_PROVIDER`. Confirm with:

```bash
bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect off
```

### auth on (Prompts 2–3)

`$PROJECT_DIR/.env` must have all four:

```dotenv
AUTH_PROVIDER=workos
WORKOS_API_KEY=<key>
WORKOS_CLIENT_ID=<id>
WORKOS_ORGANIZATION_ID=<org-id>
```

Optional but commonly set: `WORKOS_REDIRECT_URI` (defaults to
`$BASE/auth/callback`), `WORKOS_COOKIE_PASSWORD`.

Confirm with:

```bash
bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect on
```

If preflight reports missing vars, surface that to the user — don't edit
`.env` without explicit consent. The user can either add the lines
themselves or dictate values for you to write.

## Steps

### 0. Auth ON — extract the session cookie for curl

The WorkOS session cookie is `httpOnly`, so `curl` cannot mint it via `/sign-in` and `document.cookie` cannot read it in the browser. **Do this before any other auth-on step that uses `curl`.** Don't fall back to "UI only" — every snippet below uses `-H "Cookie: $COOKIE"` and this is how you get the value.

The scaffold ships a debug route gated by `SMOKE_TEST_COOKIE_LEAK=1` that echoes back the request's Cookie header. `scaffold.sh` writes this line into `.env` automatically whenever the `--workos-*` flags trigger auth-on mode, so you should not normally need to add it by hand.

> **Ordering gotcha.** The `apiRoutes` array is built **once** when `mastra dev` boots, from `process.env.SMOKE_TEST_COOKIE_LEAK`. If the flag isn't set in `.env` before that boot, `GET /smoke-test/cookie` returns `404` even though it appears in this doc. If you see a 404 here, the fix is always "stop `mastra dev`, confirm the line is in `$PROJECT_DIR/.env`, restart" — never try to enable it at runtime via curl or browser. Verify with `grep SMOKE_TEST_COOKIE_LEAK "$PROJECT_DIR/.env"` before restarting.

Recipe:

```bash
# 1. Confirm the leak flag is in $PROJECT_DIR/.env (scaffold.sh writes it for auth-on).
grep -q '^SMOKE_TEST_COOKIE_LEAK=1' "$PROJECT_DIR/.env" \
  || echo 'SMOKE_TEST_COOKIE_LEAK=1' >> "$PROJECT_DIR/.env"
# 2. Restart `mastra dev` so it picks up the env change (only needed if step 1 wrote anything).
# 3. In the browser, sign in via WorkOS (navigate to $BASE/agent-builder).
# 4. In the same browser session, navigate to $BASE/smoke-test/cookie
#    and copy the response body (it's the raw Cookie header).
# 5. Export it for the rest of the run:
export COOKIE='wos-session=...; Path=/; ...'
```

After that, every `-H 'Cookie: <session-cookie>'` placeholder below becomes `-H "Cookie: $COOKIE"`. Re-run steps 3-5 if the dev server is restarted with a different `WORKOS_COOKIE_PASSWORD` (the scaffold derives a stable one, so this is usually a one-shot operation per scaffold).

### 1. Auth ON — verify login required

Ensure `--expect on` passes, restart `mastra dev` if you just edited `.env`.

```bash
curl -s -o /dev/null -w '%{http_code}' $BASE/stored/agents
```

- [ ] Returns 401 (not 200)
- [ ] Response body is JSON, not HTML or a stack trace

In the browser:

- [ ] Navigate to `http://localhost:4111/agent-builder`
- [ ] Redirected to WorkOS login
- [ ] After login, builder loads normally

### 1b. Auth ON — assert the logged-in role matches `--role`

`--role` defaults to `admin`. After login, ask the server who you are:

```bash
curl -s -H "Cookie: <session-cookie>" "$BASE/auth/me" | jq '{id, email, roles, permissions}'
```

- [ ] HTTP 200 + JSON body with `id`, `email`, `roles`, `permissions` (the user identifier field is `id`, not `userId`)
- [ ] `roles` includes the value passed via `--role` (e.g. `--role viewer` → `roles` contains `"viewer"`)

If `roles` does not contain the `--role` value, **stop the run** and tell the user:

> The logged-in user's roles are `<actual roles>` but `--role` is `<expected>`. Either change your WorkOS role to `<expected>` and restart the server, or re-run the smoke test with `--role <one of your actual roles>`.

Do not try to "simulate" a different role by setting headers — there is no server-side role-override header in this build. The only way to test a different role is to log in as a user who actually has it.

### 2. Auth ON — verify authorId is set

After logging in, create an entity (use the browser session or copy the
session cookie into curl):

```bash
curl -s -X POST $BASE/stored/skills \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <session-cookie>' \
  -d '{
    "name": "Auth Test Skill",
    "description": "Created to verify authorId is set under auth-on",
    "instructions": "Auth-on smoke test placeholder."
  }' | jq '.authorId'
```

- [ ] `authorId` is a non-empty string matching the logged-in WorkOS user ID (typically prefixed `user_…`); it must not be `null`, `undefined`, or omitted

### 3. Auth ON → Auth OFF — switch mode

1. Comment out the `AUTH_PROVIDER=workos` line in `$PROJECT_DIR/.env` (one
   `#` at the start of the line).
2. Restart the dev server (kill the existing `mastra dev` process, then re-run from `$PROJECT_DIR`).
3. Re-run preflight with the new expectation:

   ```bash
   bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect off
   ```

- [ ] Preflight reports detected mode `off`
- [ ] API returns 200 without a session:

  ```bash
  curl -s -o /dev/null -w '%{http_code}' $BASE/stored/agents
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

- [ ] Creating entities returns `200/201` with no `authorId` in the response (the server resolves `getCallerAuthorId` → `null` and writes the row without an author)
- [ ] Reads / writes succeed without any auth header
- [ ] Library page still surfaces public skills

### 6. Error handling

Re-enable auth (uncomment `AUTH_PROVIDER=workos`, restart). Make an
unauthenticated request:

```bash
curl -s $BASE/stored/agents | jq .
```

- [ ] Clear JSON error (401/403), not a server crash
- [ ] Error body is JSON-shaped, not HTML

## Notes

- Auth changes require a server restart — `mastra dev` only reads `.env` at
  boot.
- The WorkOS session cookie is httpOnly, so a Stagehand-style browser
  automation picks it up automatically.
- `authorId` on entities created while auth is off will be missing/`null` (the handler resolves it from request context, which has no caller). Records created while auth was on keep their original `authorId` after a mode flip — they are never rewritten.

## Checklist

- [ ] Preflight reports the expected mode before each phase of this section
- [ ] Auth ON: API returns 401 without session
- [ ] Auth ON: browser redirects to login
- [ ] Auth ON: `authorId` set on created entities
- [ ] Auth OFF: API accessible without auth
- [ ] Auth OFF: browser loads without login
- [ ] Auth ON → OFF: data persists, `authorId` preserved
- [ ] Unauthenticated requests return clean JSON errors

## Appendix: FGA in this example

Background on the fine-grained authorization layer — only relevant if an
auth-on run surfaces an `FGADeniedError`.

- `MastraFGAWorkos` is the WorkOS-backed FGA provider. It's constructed
  in the scaffolded project's `src/mastra/auth.ts` (via `initWorkOS()` from
  `@mastra/auth-workos`) and resolves per-resource permissions ("can user X
  `:read` agent Y") against the WorkOS organization named by
  `WORKOS_ORGANIZATION_ID`.
- FGA fires only when (a) a route declares an `fga` block in its metadata
  AND (b) the server has an FGA provider configured (which, in this
  example, means `AUTH_PROVIDER=workos`). There is no separate enable/
  disable env var.
- If FGA denies a request during an auth-on run, the most likely causes
  are: `WORKOS_ORGANIZATION_ID` doesn't match the org the FGA tuples are
  stored under, or the logged-in user has no matching tuple. Report the
  denial along with the org/user combo — don't try to disable FGA
  independently, it's coupled to WorkOS auth here.
