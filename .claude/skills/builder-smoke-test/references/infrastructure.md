# Infrastructure

The `/editor/builder/infrastructure` endpoint reports configured channels, browser, workspace, and registries. The Agent Builder Infrastructure page (admin-only) renders this.

## Source-of-truth

Endpoint: `GET /editor/builder/infrastructure` (requires `infrastructure:read`).

Returns `{ channels, browser, workspace, registries }`.

- `channels` includes only providers that report `isConfigured: true`
- `browser` shows the resolved provider name + non-omitted config entries (provider/env are dropped)
- `workspace` shows `type` (id | inline), filesystem provider, sandbox provider, plus config entries
- `registries` is the array `[{ id: 'skills-sh', enabled, label }]` from `builder.getRegistries()`

Unset config keys are emitted as `null` and rendered as "Provider default" (browser) or "Not set" (workspace).

## Steps

### 1. Admin can read

```bash
curl -s -H "$SESSION" -H 'X-Mastra-Role-Preview: admin' "$BASE/editor/builder/infrastructure" | jq .
```

- [ ] 200
- [ ] Top-level keys: `channels`, `browser`, `workspace`, `registries`

### 2. Non-admin cannot read

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "$SESSION" -H 'X-Mastra-Role-Preview: viewer' \
  "$BASE/editor/builder/infrastructure"
```

- [ ] 403 (or 404 if route-hidden — both acceptable)

### 3. Browser block

```bash
curl -s "$BASE/editor/builder/infrastructure" | jq '.browser'
```

- [ ] `provider` is `"stagehand"` (matches inline config in `examples/agent`)
- [ ] No duplicate `provider`/`env` entries in `config`
- [ ] Type indicator NOT present (browser is always inline; type was intentionally removed)

### 4. Workspace block

```bash
curl -s "$BASE/editor/builder/infrastructure" | jq '.workspace'
```

- [ ] `type` is `"id"` (matches `workspace: { type: 'id', workspaceId: 'builder-workspace' }`)
- [ ] `filesystemProvider` set
- [ ] `sandboxProvider` set
- [ ] Config entries shown for filesystem + sandbox; unset values are `null`

If you uncomment the inline workspace block in `examples/agent/src/mastra/index.ts` and restart:

- [ ] `type` flips to `"inline"`
- [ ] `routeCount` (or equivalent count field) updates

### 5. Channels block

```bash
curl -s "$BASE/editor/builder/infrastructure" | jq '.channels'
```

- [ ] Only configured channels appear (Slack appears only if `SLACK_*` env vars are set)
- [ ] Each entry shows provider name + non-null config fields

### 6. Registries block

```bash
curl -s "$BASE/editor/builder/infrastructure" | jq '.registries'
```

- [ ] Array with at least one entry `{ id: 'skills-sh', enabled, label }`
- [ ] `enabled` matches `builder.registries.skillsSh.enabled` from config (default `false`)
- [ ] Flipping `enabled` in config + restart → reflected here

### 7. UI: Agent Builder Infrastructure page

Navigate to `http://localhost:4111/agent-builder/infrastructure`.

- [ ] Page loads for admin
- [ ] Sidebar shows "Infra" link below a divider, matching Studio's style
- [ ] Browser, Workspace, Channels, Registries sections rendered
- [ ] Unset values show "Provider default" / "Not set" rather than empty strings
- [ ] Mobile bottom-bar also exposes the "Infra" link
- [ ] Viewer/member: link hidden; direct navigation denied

## Checklist

- [ ] Admin can GET; non-admin cannot
- [ ] Browser block: provider name, no duplicate env, no type field
- [ ] Workspace block: type, filesystem/sandbox providers, config entries with nulls
- [ ] Channels block: only configured providers
- [ ] Registries block: skills-sh enabled flag reflects config
- [ ] UI page renders all blocks
- [ ] Sidebar + mobile bottom-bar link gated by `infrastructure:read`
