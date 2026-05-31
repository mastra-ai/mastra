# Infrastructure

The `/editor/builder/infrastructure` endpoint reports configured channels, browser, workspace, and registries. The Agent Builder Infrastructure page renders this. The payload is deployment-shape only — provider names and enabled/disabled flags, no secrets — so all default roles can read it (`*:read` matches `infrastructure:read`).

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

### 1. Any signed-in role can read

```bash
curl -s -H "$SESSION" "$BASE/editor/builder/infrastructure" | jq .
```

- [ ] HTTP 200
- [ ] Top-level keys present: `channels`, `browser`, `workspace`, `registries`
- [ ] Works for `admin`, `member`, and `viewer` — the gate is `infrastructure:read`, and every default role has `*:read`

### 2. Unauthenticated cannot read

With auth on and no session cookie:

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/editor/builder/infrastructure"
```

- [ ] HTTP 401 (no session)

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
- [ ] `name` is present (e.g. `"Builder Workspace"`) and `source` reflects builder metadata
- [ ] `registered` is `true`; `hasFilesystem` is `true`; `hasSandbox` reflects scaffold config
- [ ] `filesystemProvider` populated (e.g. `"local"`); `sandboxProvider` may be `null` when no sandbox is configured
- [ ] `config` is an array of `{key, value}` pairs — may be empty `[]` when the workspace block doesn't expose tunables

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
- [ ] Viewer/member: link visible (every default role has `*:read`, which matches `infrastructure:read`); direct navigation also resolves

## Checklist

- [ ] Every default role with `*:read` (admin, member, viewer) can GET — the gate is `infrastructure:read`
- [ ] Browser block: `type`, `provider`, `registered`, `availableProviders`, `config` all present
- [ ] Workspace block: `type`, `workspaceId`, `filesystemProvider`, `sandboxProvider`, `config`
- [ ] Channels block: `{ providers: [...] }` shape; only configured providers listed
- [ ] Registries block: `{ skillsSh: { enabled } }` object shape (not array)
- [ ] UI page renders Browser / Workspace / Channels / Registries sections; sidebar + mobile bottom-bar link gated by `infrastructure:read` (visible to every default role under auth-on)
