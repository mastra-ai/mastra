# Infrastructure

The `/editor/builder/infrastructure` endpoint reports configured channels, browser, workspace, and registries. The Agent Builder Infrastructure page (admin-only in the UI) renders this.

## Source-of-truth

Endpoint: `GET /editor/builder/infrastructure` (requires `infrastructure:read`).

Schema (`packages/server/src/server/schemas/editor-builder.ts` → `infrastructureStatusResponseSchema`):

```ts
{
  channels: { providers: Array<{ id, name, isConfigured, routeCount }> },
  browser:  { type, provider, env, registered, availableProviders, config: [{key,value}] },
  workspace:{ type, workspaceId, name, source, registered, hasFilesystem, hasSandbox,
              filesystemProvider, sandboxProvider, config: [{key,value}] },
  registries: { skillsSh: { enabled } },
}
```

Notes:

- `channels.providers` is filtered server-side to providers that report `isConfigured: true`.
- `browser.config` and `workspace.config` are arrays of `{key, value}` pairs. Unset values are emitted as `null` (not omitted), so the UI can render "Provider default" / "Not set".
- `registries` is an **object** keyed by registry id (currently only `skillsSh`), not an array. Each value is `{ enabled }`.

## Steps

### 1. Admin can read

```bash
curl -s -H "$SESSION" "$BASE/editor/builder/infrastructure" | jq .
```

- [ ] HTTP 200
- [ ] Top-level keys present: `channels`, `browser`, `workspace`, `registries`

### 2. Non-admin cannot read

Use a session whose user has only `*:read` (member or viewer per default-role grants in `roles.ts`). `infrastructure:read` is not granted by default; only `admin`/`owner` get it.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "$SESSION" "$BASE/editor/builder/infrastructure"
```

- [ ] HTTP 403 (or 404 if route-hidden — both acceptable)

### 3. Browser block

```bash
curl -s -H "$SESSION" "$BASE/editor/builder/infrastructure" | jq '.browser'
```

- [ ] `provider` is `"stagehand"` (matches inline config in the scaffolded project's `src/mastra/index.ts`)
- [ ] `type` is `"inline"` (matches `browser: { type: 'inline', config: ... }`)
- [ ] `registered` is `true`
- [ ] `availableProviders` is a non-empty array
- [ ] `config` is an array of `{key, value}` pairs; unset values appear as `null`

### 4. Workspace block

```bash
curl -s -H "$SESSION" "$BASE/editor/builder/infrastructure" | jq '.workspace'
```

- [ ] `type` is `"id"` (matches `workspace: { type: 'id', workspaceId: 'builder-workspace' }`)
- [ ] `workspaceId` is `"builder-workspace"`
- [ ] `filesystemProvider` and `sandboxProvider` populated
- [ ] `config` is an array of `{key, value}` pairs

If you change the inline workspace block in the scaffolded project's `src/mastra/index.ts` and restart:

- [ ] `type` flips to `"inline"`

### 5. Channels block

```bash
curl -s -H "$SESSION" "$BASE/editor/builder/infrastructure" | jq '.channels'
```

- [ ] Shape is `{ providers: [...] }` (object with `providers` array, not a bare array)
- [ ] Only providers with `isConfigured: true` are present (Slack appears only if `SLACK_*` env vars are set)
- [ ] Each entry has `id`, `name`, `isConfigured`, `routeCount`

### 6. Registries block

```bash
curl -s -H "$SESSION" "$BASE/editor/builder/infrastructure" | jq '.registries'
```

- [ ] Shape is `{ skillsSh: { enabled: <boolean> } }` (object keyed by registry id, not an array)
- [ ] `skillsSh.enabled` matches `builder.registries.skillsSh.enabled` from config (default `false`)
- [ ] Flipping `enabled` in config + restart → reflected here

### 7. UI: Agent Builder Infrastructure page

Navigate to `http://localhost:4111/agent-builder/infrastructure`.

- [ ] Page loads for admin
- [ ] Sidebar shows "Infra" link below a divider, matching Studio's style
- [ ] Browser, Workspace, and Channels sections render
- [ ] Unset values show "Provider default" / "Not set" rather than empty strings
- [ ] Mobile bottom-bar also exposes the "Infra" link
- [ ] Viewer/member: link hidden; direct navigation denied

## Checklist

- [ ] Admin can GET; non-admin cannot
- [ ] Browser block: `type`, `provider`, `registered`, `availableProviders`, `config` all present
- [ ] Workspace block: `type`, `workspaceId`, `filesystemProvider`, `sandboxProvider`, `config`
- [ ] Channels block: `{ providers: [...] }` shape; only configured providers listed
- [ ] Registries block: `{ skillsSh: { enabled } }` object shape (not array)
- [ ] UI page renders Browser / Workspace / Channels sections; sidebar + mobile bottom-bar link gated by `infrastructure:read`
