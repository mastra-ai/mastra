# Restart smoke test — `ToolProvider` v1 extensions

Companion to `RESTART-ON-MARQUESS-PLAN.md`. Run after Phase 10 (RBAC + example wiring).

---

## Prereqs

```bash
cd examples/agent-builder
rm -f src/mastra/public/mastra.db    # fresh DB
pnpm dev                              # http://localhost:4111
```

Required env in `examples/agent-builder/.env`:

```bash
COMPOSIO_API_KEY=...
WORKOS_CLIENT_ID=...
WORKOS_API_KEY=...
WORKOS_COOKIE_PASSWORD=...
MASTRA_AUTO_DETECT_URL=true
MASTRA_ENCRYPTION_KEY=...             # if testing channels
SLACK_APP_CONFIG_REFRESH_TOKEN=...    # if testing Slack
```

Users needed:
- **Alice** — admin role
- **Bob** — member role

---

## Scenario 1 — per-author scope (Agent Builder)

- [ ] Sign in as Alice
- [ ] Agent Builder → create agent `gmail-author-test`
- [ ] Tools → pick `GMAIL_SEND_EMAIL`
- [ ] Picker → **Connect new account**, scope = **Per-author**, label = `alice-gmail`
- [ ] Complete OAuth
- [ ] Save agent
- [ ] Verify storage:
  ```bash
  sqlite3 examples/agent-builder/src/mastra/public/mastra.db \
    "SELECT scope, label, author_id FROM mastra_tool_provider_connections;"
  ```
  Expect: `per-author | alice-gmail | <alice's id>`
- [ ] Chat with agent → ask to send test email → tool runs

---

## Scenario 2 — shared scope (Agent Editor / CMS)

- [ ] As Alice → Agents (CMS) → open or create a code-defined agent
- [ ] Tools tab → pick a Composio tool
- [ ] Picker → **Connect new**, scope = **Shared**, label = `org-slack`
- [ ] Complete OAuth
- [ ] Verify storage:
  ```bash
  sqlite3 examples/agent-builder/src/mastra/public/mastra.db \
    "SELECT scope, label, author_id FROM mastra_tool_provider_connections WHERE scope='shared';"
  ```
  Expect: `shared | org-slack | <SHARED_BUCKET_ID>`
- [ ] Sign out, sign in as Bob
- [ ] Open same CMS agent → run it → shared tool works

---

## Scenario 3 — caller-supplied scope (multi-tenant)

- [ ] As Alice → Agents (CMS) → create agent `tenant-gmail`
- [ ] Tools → pick a Composio tool → scope = **Caller-supplied**
- [ ] Picker hides "Connect new" and "Use existing" — shows help text only
- [ ] Save agent
- [ ] Verify storage:
  ```bash
  sqlite3 examples/agent-builder/src/mastra/public/mastra.db \
    "SELECT scope, connection_id FROM mastra_tool_provider_connections WHERE scope='caller-supplied';"
  ```
  Expect: `caller-supplied | <NULL or placeholder>`
- [ ] Runtime happy path:
  ```bash
  curl -X POST http://localhost:4111/api/agents/tenant-gmail/generate \
    -H "Content-Type: application/json" \
    -H "x-mastra-resource-id: tenant-123" \
    -d '{"messages":[{"role":"user","content":"send email"}]}'
  ```
  Expect: tool resolves under `userId=tenant-123` (OAuth may fail but resolution path runs)
- [ ] Runtime error path (no resource-id header):
  ```bash
  curl -X POST http://localhost:4111/api/agents/tenant-gmail/generate \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"send email"}]}'
  ```
  Expect: `MastraError` id `CALLER_SUPPLIED_USER_ID_MISSING`
- [ ] Authorize error path:
  ```bash
  curl -X POST http://localhost:4111/api/tool-providers/composio/authorize \
    -H "Content-Type: application/json" \
    -d '{"toolService":"GMAIL","scope":"caller-supplied"}'
  ```
  Expect: HTTP 400

---

## Scenario 4 — admin cross-author visibility

- [ ] As Bob → create agent → pin per-author Composio connection labeled `bob-github`
- [ ] Sign out, sign in as Alice
- [ ] Open any agent with Composio tools
- [ ] Picker shows admin filter dropdown: "All authors" / "My connections" / Bob's id
- [ ] Select "All authors" → Bob's `bob-github` appears with owner badge
- [ ] Confirm Alice cannot pin Bob's connection on her own agent (visible only)

---

## Scenario 5 — capabilities flag (Arcade adapter)

- [ ] Add Arcade to `examples/agent-builder/src/mastra/index.ts`:
  ```ts
  toolProviders: {
    composio: new ComposioToolProvider({ apiKey: process.env.COMPOSIO_API_KEY! }),
    arcade: new ArcadeToolProvider({ apiKey: process.env.ARCADE_API_KEY! }),
  }
  ```
- [ ] Restart, Agent Builder → pick Arcade tool
- [ ] Picker shows limited UI: no "Connect new" button, no scope toggle (or only caller-supplied)
- [ ] Composio tools in same agent still show full picker

---

## Scenario 6 — mixed scopes per agent

- [ ] Create agent `mixed-scopes` with:
  - `GMAIL_SEND_EMAIL` → scope `caller-supplied`
  - `SLACK_POST_MESSAGE` → scope `shared`
- [ ] Save
- [ ] Run with header `x-mastra-resource-id: tenant-abc`
- [ ] Traces/logs: Gmail under `tenant-abc`, Slack under `SHARED_BUCKET_ID`

---

## Scenario 7 — disconnect lifecycle

- [ ] As Alice → pick a pinned connection → kebab menu → **Disconnect**
- [ ] Confirm dialog
- [ ] Picker row removed
- [ ] Storage row deleted:
  ```bash
  sqlite3 examples/agent-builder/src/mastra/public/mastra.db \
    "SELECT * FROM mastra_tool_provider_connections WHERE label='alice-gmail';"
  ```
  Expect: empty
- [ ] Composio dashboard: connection revoked

---

## Scenario 8 — health pill

- [ ] Set `COMPOSIO_API_KEY=invalid`, restart
- [ ] Agent Builder header → red health pill with error tooltip
- [ ] Set valid key, restart → green pill

---

## Scenario 9 — MCP regression check

- [ ] Add MCP tool to a CMS agent via existing MCP UI flow
- [ ] MCP tool resolves and runs as before
- [ ] No errors in logs related to MCP path

---

## Pass criteria

- All 9 scenarios pass
- Storage values match expected scope/label/author_id
- No `tool-provider` or `connection` resolution errors in logs
- UI gates correctly per capabilities flag and RBAC role
- MCP path untouched and working
