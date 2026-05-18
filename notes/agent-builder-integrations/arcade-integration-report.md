# Arcade.dev + Agent Builder — Integration Report

**Status:** Prototype on `yj/arcade-agent-builder`. Multi-binding (platform / author / invoker) implemented end-to-end. Invoker mode blocked at runtime by Arcade's default OAuth verifier (custom OAuth app required).

---

## TL;DR

- Arcade is wired as a **tool provider** behind the generic `ToolProvider` interface.
- Admin selects toolkits + tools in the agent builder; bindings live **per toolkit** on the stored agent.
- A binding has a **mode** (`platform` / `author` / `invoker`) and a server-minted `arcadeUserId` (the token-bucket key Arcade uses internally).
- At runtime, `resolveStoredIntegrationTools` **fans out** each tool into one renamed instance per binding so the LLM can pick which account to route through.
- Invoker mode lazily renders a "Connect" badge in chat when no token exists yet for the end user.

---

## 1. Component Map

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         CORE                                              │
│  packages/core/src/storage/types.ts                                       │
│    • ArcadeBindingKind = 'platform' | 'author' | 'invoker'                │
│    • ArcadeConnectionBinding { kind, arcadeUserId?, label? }              │
│    • StorageIntegrationToolsConfig { tools, bindings }                    │
│  packages/core/src/tool-provider/types.ts                                 │
│    • ToolProvider interface (listToolkits/listTools/resolveTools/         │
│      authorize/getAuthStatus/getConnectionStatus)                         │
│  packages/core/src/editor/types.ts                                        │
│    • MastraEditor config: toolProviders[]                                 │
└───────────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ implements
                                  │
┌───────────────────────────────────────────────────────────────────────────┐
│                         EDITOR                                            │
│  packages/editor/src/providers/arcade.ts                                  │
│    • ArcadeToolProvider (uses @arcadeai/arcadejs)                         │
│    • buildBindingSuffix(...) → __WORK, __A3F2, __INVOKER, __WORK_2        │
│    • buildConnectRequiredTool(...) → stub with __arcadeConnectRequired    │
│  packages/editor/src/providers/filtered.ts                                │
│    • FilteredToolProvider (allowlist wrapper, fan-out per toolkit)        │
│  packages/editor/src/namespaces/agent.ts                                  │
│    • resolveStoredIntegrationTools(...)  ← fan-out resolver               │
│    • resolveArcadeUserId(binding, ctx, toolkit)                           │
└───────────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ HTTP
                                  │
┌───────────────────────────────────────────────────────────────────────────┐
│                         SERVER                                            │
│  packages/server/src/server/handlers/tool-providers.ts                    │
│    • LIST / TOOLS / AUTHORIZE / STATUS / CONNECTION_STATUS routes         │
│  packages/server/src/server/schemas/{stored-agents,agent-versions}.ts     │
│    • Zod schemas for tools + bindings persistence                         │
└───────────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ client-js SDK
                                  │
┌───────────────────────────────────────────────────────────────────────────┐
│                         PLAYGROUND (Studio UI)                            │
│  domains/tool-providers/                                                  │
│    • tool-provider-dialog.tsx (pick toolkits/tools)                       │
│    • integration-tools-section.tsx (per-toolkit binding rows)             │
│    • binding-mode-toggle.tsx (platform/author/invoker)                    │
│    • arcade-connect-required-badge.tsx (chat connect prompt)              │
│    • hooks/use-tool-provider-auth.ts (authorize + poll status)            │
│  domains/agents/ (CMS Tools page)                                         │
│    • tools-page.tsx (admin authorize flow)                                │
│  domains/agent-builder/                                                   │
│    • schemas.ts, mappers/* (form ↔ storage shape)                         │
│    • route-integration-input.ts (builder agent adds tools → bindings)     │
│  lib/ai-ui/tools/tool-fallback.tsx                                        │
│    • detects __arcadeConnectRequired and renders the badge                │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Model

### Stored agent shape

```ts
storedAgent.integrationTools = {
  arcade: {
    // selected tool slugs (no connection info — bindings own that)
    tools: {
      "Gmail.ListEmails": { description?: string },
      "Gmail.SendEmail":  {},
      "Slack.SendMessage": {},
    },
    // per-toolkit bindings; all tools in a toolkit share the same set
    bindings: {
      Gmail: [
        { kind: 'platform', label: 'Work',     arcadeUserId: 'work@acme.com' },
        { kind: 'platform', label: 'Personal', arcadeUserId: 'me@gmail.com'  },
      ],
      Slack: [
        { kind: 'invoker' }, // no arcadeUserId — derived at runtime
      ],
    },
  },
};
```

### Key invariants

- `bindings[toolkit]` is the unit of OAuth identity for **all tools in that toolkit**.
- `arcadeUserId` is opaque to Arcade — it's just the lookup key for an OAuth token bucket.
- For `platform`/`author`, `arcadeUserId` is **server-minted at save time** and stable across label renames.
- For `invoker`, `arcadeUserId` is **derived at runtime** from `requestContext[MASTRA_RESOURCE_ID_KEY]`.

---

## 3. Mode Semantics

| Mode | `arcadeUserId` source | Authorized by | When |
|------|----------------------|---------------|------|
| `platform` | Server-minted, stored on binding | Admin (or whoever owns the verified email used as label/userId) | Build time, in the Tools page |
| `author` | Server-minted, stored on binding | Agent author | Build time. Functionally same as platform today; reserved for multi-tenant. |
| `invoker` | `mastra:user:{resourceId}:conn:{toolkit}` | End user | First tool call. Connect-required badge rendered in chat. |

---

## 4. End-to-End Flows

### 4.1 Configure (app startup)

```
examples/agent-builder/src/mastra/index.ts
  ┌────────────────────────────────────────────────────────┐
  │ new Mastra({                                           │
  │   editor: new MastraEditor({                           │
  │     toolProviders: [                                   │
  │       new FilteredToolProvider({                       │
  │         inner: new ArcadeToolProvider({ apiKey }),     │
  │         allowedTools: ['Gmail.*', 'Slack.*', ...],     │
  │       }),                                              │
  │     ],                                                 │
  │   }),                                                  │
  │ })                                                     │
  └────────────────────────────────────────────────────────┘
```

- `ArcadeToolProvider` is a thin wrapper over `@arcadeai/arcadejs`.
- `FilteredToolProvider` enforces the admin's allowlist and fans out `listTools` per allowed toolkit so the UI sees every allowed tool, not just the first 50.

### 4.2 Author — admin builds an agent

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Admin (Tools page)                             │
└─────────────────────────────────────────────────────────────────────────┘
   │
   │ 1. Click "Add tools"
   ▼
   tool-provider-dialog.tsx
   ├── ToolkitList (lists allowed toolkits from provider)
   ├── ToolList    (lists tools in selected toolkit)
   └── SelectedToolList (just shows what's selected; no per-tool binding)
   │
   │ 2. Save → form.integrationTools picks up the new slugs
   ▼
   integration-tools-section.tsx (one row per toolkit)
   ├── BindingModeToggle: platform / author / invoker
   │     (changes ALL bindings for that toolkit's kind)
   ├── For each binding row:
   │     • label input
   │     • Authorize button (platform/author only)
   │     • status badge (via useConnectionStatus)
   └── "+ Add binding" → appends a new binding entry
   │
   │ 3. Click Authorize on a binding
   ▼
   useToolProviderAuth.authorize(providerId, { toolName, arcadeUserId })
   │
   ▼
   POST /api/tool-providers/arcade/authorize
   │
   ▼
   ArcadeToolProvider.authorize → client.tools.authorize(...)
   │
   ▼  returns { url, id }
   popup → user completes OAuth → token stored at Arcade against arcadeUserId
   │
   ▼
   client polls getAuthStatus(id) until 'completed'
   │
   ▼  optimistic refresh of useConnectionStatus
   "Authorized" badge appears
   │
   │ 4. Save agent
   ▼
   form-values-to-save-params.ts
     • mints arcadeUserId for platform/author bindings that don't have one
       (format: mastra:agent:{slug}:tk:{toolkit}:{labelSlug})
     • invoker bindings stored WITHOUT arcadeUserId
   ▼
   POST /api/stored-agents/:id   → integrationTools persisted
```

### 4.3 Builder agent adds a tool

```
User in chat: "add Gmail send-email"
   │
   ▼
agentBuilderTool schema has an `integrations` branch:
   { integrations: [{ provider: 'arcade', tool: 'Gmail.SendEmail' }] }
   │
   ▼
route-integration-input.ts:
   • appends 'Gmail.SendEmail' to integrationTools
   • if bindings[Gmail] is empty → adds a default
       { kind: 'platform', label: 'Gmail', arcadeUserId: '' }
   • Admin must visit Tools page to authorize before runtime works
```

### 4.4 Runtime — chat starts

```
POST /api/agents/{id}/stream  (with requestContext)
   │
   ▼
StoredAgentNamespace.getAgent(id, requestContext)
   │
   ▼
resolveStoredIntegrationTools(storedAgent.integrationTools, requestContext)
   │
   ▼
   for each provider (arcade):
     for each toolkit (Gmail, Slack):
       bindings = providerConfig.bindings[toolkit]
       toolkitSlugs = tools whose slug starts with `${toolkit}.`
       skipSuffix = bindings.length === 1

       for each binding in bindings:
         arcadeUserId = resolveArcadeUserId(binding, ctx, toolkit)

         if binding.kind === 'invoker' && !arcadeUserId:
           # No resource id in context → emit stub tools
           for each slug in toolkitSlugs:
             allTools[slug + suffix] = buildConnectRequiredTool(...)
           continue

         resolved = provider.resolveTools(
           toolkitSlugs,
           providerConfig.tools,
           { requestContext, userId: arcadeUserId }
         )

         suffix = skipSuffix ? '' : '__' + buildBindingSuffix(...)

         for each [toolId, tool] in resolved:
           desc = tool.description
           if multi-binding:
             desc += `\n\nRoutes through connection: ${binding.label}`
           allTools[toolId + suffix] = { ...tool, id: toolId+suffix, description: desc }
```

### 4.5 LLM execution — fan-out result

Stored agent has two Gmail bindings (`Work`, `Personal`) and one tool `Gmail.ListEmails`. The LLM receives:

```
Gmail.ListEmails__WORK
  description: List Gmail emails.
               Routes through connection: Work
Gmail.ListEmails__PERSONAL
  description: List Gmail emails.
               Routes through connection: Personal
```

```
User: "show me unread emails from both my accounts"
   │
   ▼
LLM picks both tools in parallel
   │
   ├── Gmail.ListEmails__WORK     → ArcadeToolProvider.execute()
   │                                  client.tools.execute({
   │                                    tool_name: 'Gmail.ListEmails',
   │                                    user_id: 'work@acme.com',
   │                                  })
   │
   └── Gmail.ListEmails__PERSONAL → execute({ user_id: 'me@gmail.com' })
   │
   ▼
Arcade Cloud:
   • Looks up OAuth token per user_id
   • Calls Gmail API with that token
   • Returns rows
   │
   ▼
LLM composes a unified answer
```

Arcade only ever sees the original slug (`Gmail.ListEmails`) and a `user_id`. The suffixed alias exists **only inside Mastra's tool registry** so the LLM can dispatch by name.

### 4.6 Runtime — invoker mode with no connection yet

```
binding = { kind: 'invoker' } in storage
   │
   ▼
resolveArcadeUserId →
   if no resourceId in requestContext: undefined
   else: mastra:user:{resourceId}:conn:{toolkit}
   │
   ▼
provider.resolveTools(...) is called with userId from above
   │
   ▼
ArcadeToolProvider tries to fetch ZodTool with that userId
   │
   ▼
If Arcade reports the tool needs auth → execute() returns
   {
     error: true,
     __arcadeConnectRequired: true,
     toolkit: 'Gmail',
     userId: 'mastra:user:abc:conn:Gmail',
     message: 'Arcade toolkit "Gmail" has no active connection...',
   }
   │
   ▼
Chat UI: tool-fallback.tsx → detectArcadeConnectRequired(result)
   │
   ▼  matches marker
ArcadeConnectRequiredBadge:
   ┌────────────────────────────────────────────────────┐
   │ Gmail needs to be connected to continue.           │
   │                                  [ Connect ]      │
   └────────────────────────────────────────────────────┘
   │
   │ user clicks Connect
   ▼
useToolProviderAuth.authorize(providerId, { toolName, arcadeUserId })
   → fetches a fresh OAuth URL on click (matches Composio's pattern)
   → opens popup
   → polls until completed
   │
   ▼
User re-asks; next call to that tool succeeds (token now exists for that userId).
```

---

## 5. Tool-Name Suffix Algorithm

`buildBindingSuffix({ kind, label, arcadeUserId, used })`:

```
if label && label.trim():
   base = label uppercased, non-alnum → '_', stripped  →  "WORK"
elif kind === 'invoker':
   base = "INVOKER"
elif arcadeUserId:
   base = uppercase 4-hex hash of arcadeUserId          →  "A3F2"
else:
   base = "CONN"

# collision handling within toolkit
candidate = base
n = 2
while candidate in used:
   candidate = base + "_" + n; n++
return candidate
```

Single-binding toolkits **skip the suffix entirely** so the LLM sees the natural tool name.

---

## 6. Schemas & Routes

### Storage shape (Zod, server/schemas)

```ts
integrationToolsConfigSchema = {
  tools:    Record<string, { description?: string }>,
  bindings: Record<string, ArcadeConnectionBinding[]>,
}
```

### Tool provider HTTP routes

```
GET  /api/tool-providers                          → list providers
GET  /api/tool-providers/:id/toolkits             → list toolkits (allowlisted)
GET  /api/tool-providers/:id/tools                → list tools (allowlisted)
POST /api/tool-providers/:id/authorize            → start OAuth, returns { url, id }
GET  /api/tool-providers/:id/auth-status/:authId  → poll
GET  /api/tool-providers/:id/connection-status    → per-tool auth state for a user
```

All accept `arcadeUserId` from the client and forward it directly to the provider. The server is intentionally dumb about Arcade-specific semantics.

---

## 7. Sequence: Author authorizes → runtime call

```
Admin UI              Studio API           Editor                Arcade Cloud
   │                     │                    │                       │
   │ POST authorize      │                    │                       │
   │ (toolName, userId)  │                    │                       │
   ├────────────────────►│ provider.authorize │                       │
   │                     ├───────────────────►│ client.tools.authorize│
   │                     │                    ├──────────────────────►│
   │                     │                    │◄──── { url, id } ─────┤
   │◄───── url, id ──────┤◄───────────────────┤                       │
   │                                                                  │
   │ popup → user completes OAuth at provider (Google/Slack/...)      │
   │                                                                  │
   │ GET auth-status/id  │                    │                       │
   ├────────────────────►│ provider.getAuthStatus                     │
   │                     ├───────────────────►│ client.auth.status    │
   │                     │                    ├──────────────────────►│
   │                     │                    │◄──── completed ───────┤
   │◄──── completed ─────┤                                            │
   │                                                                  │
   │ POST save agent (with bindings: [{ kind:'platform', userId }])   │
   ├──── persisted ──────────────────────────────────────────────────►│
   │                                                                  │
   │ ─── later, end-user chats ───                                   │
   │                                                                  │
   │ POST /agents/:id/stream                                          │
   ├────────────────────►│ resolveStoredIntegrationTools              │
   │                     ├───────────────────►│ provider.resolveTools │
   │                     │                    │   (userId from binding)
   │                     │                    ├──────────────────────►│
   │                     │                    │◄── ZodTool defs ──────┤
   │                     │                    │                       │
   │                     │ LLM picks tool                             │
   │                     │ ──── tool.execute ─►│ client.tools.execute │
   │                     │                    │   (user_id, args)     │
   │                     │                    ├──────────────────────►│
   │                     │                    │◄────── result ────────┤
   │◄──── streamed answer ──────────────────────────────────────────  │
```

---

## 8. Connect-Required Result Shape (invoker mode)

Tool execute returns (NOT throws):

```json
{
  "error": true,
  "message": "Arcade toolkit \"Gmail\" has no active connection for user \"mastra:user:abc:conn:Gmail\". Click Connect to authorize.",
  "__arcadeConnectRequired": true,
  "toolkit": "Gmail",
  "userId": "mastra:user:abc:conn:Gmail"
}
```

`tool-fallback.tsx` matches **primarily on the marker field** (regex fallback on `message`). The badge UI then:

1. Calls `authorize` to fetch a fresh URL on click (URLs are short-lived).
2. Opens popup, polls status.
3. On completion, surfaces a hint to the user to retry. (Auto-retry deferred.)

---

## 9. Files Touched on `yj/arcade-agent-builder`

```
core:
  packages/core/src/storage/types.ts          ArcadeBindingKind, ArcadeConnectionBinding,
                                              StorageIntegrationToolsConfig
  packages/core/src/tool-provider/types.ts    authorize/getAuthStatus/getConnectionStatus

editor:
  packages/editor/src/providers/arcade.ts     buildBindingSuffix, buildConnectRequiredTool,
                                              KNOWN_TOOLKITS, ArcadeToolProvider
  packages/editor/src/providers/filtered.ts   FilteredToolProvider (allowlist + fan-out)
  packages/editor/src/namespaces/agent.ts     resolveStoredIntegrationTools, resolveArcadeUserId

server:
  packages/server/src/server/handlers/tool-providers.ts        routes
  packages/server/src/server/schemas/stored-agents.ts          bindings shape
  packages/server/src/server/schemas/agent-versions.ts         bindings shape

client-js:
  client-sdks/client-js/src/types.ts          StoredIntegrationToolsConfig
  client-sdks/client-js/src/resources/tool-provider.ts         authorize / status helpers

playground:
  domains/agents/components/agent-edit-page/utils/form-validation.ts
  domains/agents/utils/agent-form-mappers.ts
  domains/agents/components/agent-cms-pages/tools-page.tsx
  domains/tool-providers/components/tool-provider-dialog.tsx
  domains/tool-providers/components/selected-tool-list.tsx
  domains/tool-providers/components/integration-tools-section.tsx
  domains/tool-providers/components/binding-mode-toggle.tsx        (new)
  domains/tool-providers/components/arcade-connect-required-badge.tsx (new)
  domains/tool-providers/hooks/use-tool-provider-auth.ts
  domains/agent-builder/schemas.ts
  domains/agent-builder/mappers/stored-agent-to-form-values.ts
  domains/agent-builder/mappers/form-values-to-save-params.ts
  domains/agent-builder/mappers/agent-builder-tool/route-integration-input.ts
  domains/agent-builder/components/agent-builder-edit/details/tools-detail.tsx
  lib/ai-ui/tools/tool-fallback.tsx

examples:
  examples/agent-builder/src/mastra/index.ts  ArcadeToolProvider + allowlist
```

---

## 10. Known Limits & Open Issues

| Area | Status | Notes |
|------|--------|-------|
| Invoker mode end-to-end | **Blocked** | Arcade's default OAuth verifier requires `user_id` to be a verified Arcade email. Synthetic `mastra:user:...` IDs fail at `callback_verify`. Fix: configure a custom OAuth app in the Arcade Dashboard. |
| Author mode | Works | Functionally same as platform today. Persistence already separates the two for forward-compat. |
| Platform mode | Works | Admin must use a real verified email as the binding label (and we mint userId from that label or accept email-shaped labels). |
| Tool name stability | Suffix changes if admin renames a binding label → existing chat history references can break. Acceptable for prototype. |
| Backward compat | None. Old `connections` + per-tool `connectionId` agents must be re-saved. |
| Per-tool binding override | Out of scope (would mirror Composio Phase 8). |
| Auto-retry after OAuth | Out of scope; user re-asks today. |
| Workspace-level connection pool | Out of scope; deferred to its own plan. |

---

## 11. Composio Parallel (for context)

The model intentionally mirrors Composio's `bindings: Record<toolkit, ConnectionBinding[]>` shape but adapts to Arcade's stateless `user_id` model:

- **Composio:** `(userId, connectedAccountId)` pair; `ca_xxx` injected via `beforeExecute`.
- **Arcade:** `user_id` is the only knob; distinct `arcadeUserId`s = distinct token buckets = multi-account.

Result: same UX (per-toolkit mode toggle, per-binding label, fan-out aliasing, invoker connect-required badge) with a simpler runtime.

---

## 12. Quick Reference — Where to Read the Code

| Question | File |
|---|---|
| What's a binding? | `packages/core/src/storage/types.ts` |
| How are tools fanned out? | `packages/editor/src/namespaces/agent.ts` → `resolveStoredIntegrationTools` |
| How are tool aliases built? | `packages/editor/src/providers/arcade.ts` → `buildBindingSuffix` |
| How does invoker mode know the user? | `packages/editor/src/namespaces/agent.ts` → `resolveArcadeUserId` |
| Where does OAuth start? | `packages/playground/src/domains/tool-providers/hooks/use-tool-provider-auth.ts` |
| Where does the chat badge render? | `packages/playground/src/lib/ai-ui/tools/tool-fallback.tsx` + `arcade-connect-required-badge.tsx` |
| How does the builder agent add tools? | `packages/playground/src/domains/agent-builder/mappers/agent-builder-tool/route-integration-input.ts` |
