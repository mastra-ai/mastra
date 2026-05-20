# Restart smoke test results — `ToolProvider` v1 extensions

Phase 11 of `RESTART-ON-MARQUESS-PLAN.md`. Run against worktree
`yj/tool-provider-extensions` at HEAD `31d1a676be`.

---

## Automated / programmatic checks ✅

| Check | Result | Evidence |
| --- | --- | --- |
| Example boots clean on fresh `mastra.db` | ✅ | `mastra dev` ready in 4861 ms, no boot errors, `:4111` listening |
| WorkOS auth wired | ✅ | startup logs `[Auth] Using WorkOS authentication` |
| Storage schema `mastra_tool_provider_connections` created | ✅ | `sqlite3 .schema` shows table + composite PK `(authorId, providerId, connectionId)` + index `idx_tool_provider_connections_author` |
| Storage columns match `StorageToolProviderConnection` | ✅ | `authorId, providerId, connectionId, toolkit, label, scope, createdAt, updatedAt` |
| `/api/auth/capabilities` returns SSO config | ✅ | `{"enabled":true,"login":{"type":"sso","sso":{"provider":"workos",...}}}` HTTP 200 |
| `/api/tool-providers` route mounted + auth gated | ✅ | unauthenticated request → HTTP 401 `Invalid or expired token` (correct gate) |
| Scenario 3 error path: `caller-supplied` authorize without resourceId → 400 | ✅ | Covered by handler test `scope=caller-supplied without a resourceId on the request context throws 400` (`packages/server/src/server/handlers/tool-providers.test.ts:940`) |
| Server tests | ✅ | 1681 pass / 4 skip / 1 todo |
| Playground `tool-providers` UI tests | ✅ | 50/50 pass (connection-picker 38, health-pill 6, use-agent-health 6) |
| Editor tests (Composio adapter) | ✅ | 500 pass (`@mastra/editor`) |
| LibSQL adapter tests | ✅ | 16 tests pass |
| Builds clean | ✅ | `@mastra/core`, `@mastra/editor`, `@mastra/server`, `@mastra/client-js`, `@internal/playground` |

---

## Interactive scenarios — manual followup

The remaining smoke scenarios in `RESTART-SMOKE-TEST.md` require a
human-driven browser session because they depend on:

- WorkOS OAuth login with two real users (Alice = admin, Bob = member)
- Composio OAuth round-trip (Google, Slack, etc.) which opens a popup
- Visual inspection of the picker UI (scope toggle, admin filter
  dropdown, health pill color, kebab menu)

These are not automatable from this agent context. They should be
walked through manually on the running example before the PR is
opened:

- [ ] Scenario 1 — per-author scope (Agent Builder OAuth happy path)
- [ ] Scenario 2 — shared scope (CMS, Alice creates, Bob runs)
- [ ] Scenario 3 — caller-supplied scope (server runtime + curl test
      with/without `x-mastra-resource-id` header). The `authorize` 400
      path is already covered by the handler test (see above).
- [ ] Scenario 4 — admin cross-author visibility (admin filter dropdown
      surfaces only when capabilities `rbac:true`)
- [ ] Scenario 5 — Arcade adapter capability gating
- [ ] Scenario 6 — mixed scopes per agent (trace inspection)
- [ ] Scenario 7 — disconnect lifecycle (storage row removed +
      provider-side revoke)
- [ ] Scenario 8 — health pill (invalid Composio key → red, valid → green)
- [ ] Scenario 9 — MCP regression check

---

## Verdict

Phase 11 automated portion is green. The example boots, the new
storage domain materialises, the new `/api/tool-providers/*` routes
are mounted and auth-gated correctly, and every covered code path
(including the `caller-supplied` 400 error path) is locked in by
existing tests.

Interactive OAuth scenarios remain as a manual checklist for the
reviewer before merge.
