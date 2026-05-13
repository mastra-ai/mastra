# Agent Builder Integrations — Architecture

**Status:** spec / canonical reference
**Companion:** [V1-PLAN.md](./V1-PLAN.md) for ordered build steps
**Replaces:** parts of [V2.md](./V2.md) (research / Q&A log)

---

## 0. TL;DR

- One `IntegrationProvider` interface; Composio implements it in v1. Provider-agnostic by design — additional adapters slot in without interface changes.
- One `BaseIntegrationProvider` abstract class enforces allowlist filtering for free.
- One storage shape: `integrationTools[providerId] = { tools, connections }`.
- One `Connection` shape: `{ toolService, connectionId, label }`; v1 writes author-mode only.
- One generic server route surface: `/api/tool-providers/:id/...`.
- One runtime fan-out (`resolveStoredIntegrationTools`) renames tools per connection and appends a routing hint to the description.
- The LLM sees one tool per `(toolSlug × connection)`. The provider never sees the suffix.
- Per-agent health pill, batched `getConnectionStatus` per provider.
- Schema is **additive-only**, no version field, Zod `.passthrough()` preserves unknown fields.

---

## 1. Vocabulary

This spec uses **neutral, intent-revealing names** that don't leak Composio's vendor terminology, so additional providers (e.g. Arcade) can slot in later without renaming.

| Neutral term         | Means                                                                 | Composio maps to       |
| -------------------- | --------------------------------------------------------------------- | ---------------------- |
| `toolService`        | A bundle of tools sharing an OAuth boundary (Gmail, Slack, ...)       | "toolkit"              |
| `Tool`               | An individual callable slug (`gmail.fetch_emails`)                    | tool                   |
| `Connection`         | One OAuth bucket bound to one `toolService` on one agent              | one `ca_xxx`           |
| `connectionId`       | Opaque provider string identifying that bucket                        | `connectedAccountId`   |
| `Author`             | The human who created/owns the agent                                  | —                      |
| `Invoker` (v1.5)     | The end user calling the agent at runtime                             | —                      |

**Why `toolService` and not `service` / `namespace` / `toolkit`:**
- `service` alone collides with microservice / auth-service usage in core.
- `namespace` is too abstract for the UI.
- `toolkit` is Composio's word; bakes a vendor noun into the public interface.
- `toolService` reads as "service that provides tools" — intent is self-documenting at every callsite.

---

## 2. Layering

```
┌────────────────────────────────────────────────────────────────┐
│ LLM-facing tool registry (per-request)                         │
│   gmail.fetch_emails__WORK, gmail.fetch_emails__PERSONAL, ...  │
└────────────────────────────────────────────────────────────────┘
                          ▲ fan-out + rename + description hint
                          │
┌────────────────────────────────────────────────────────────────┐
│ resolveStoredIntegrationTools  (generic, provider-neutral)     │
│   loops connections, calls provider.resolveTools once per      │
│   connection                                                   │
└────────────────────────────────────────────────────────────────┘
                          ▲
                          │
┌────────────────────────────────────────────────────────────────┐
│ IntegrationProvider  (Composio in v1; others later)            │
│   listToolServices / listTools / resolveTools(one connection)  │
│   authorize / getAuthStatus / getConnectionStatus / getHealth  │
└────────────────────────────────────────────────────────────────┘
                          ▲ extends
                          │
┌────────────────────────────────────────────────────────────────┐
│ BaseIntegrationProvider  (allowlist + glob filtering)          │
└────────────────────────────────────────────────────────────────┘
                          ▲
                          │
┌────────────────────────────────────────────────────────────────┐
│ Provider SDK (@composio/mastra in v1)                          │
└────────────────────────────────────────────────────────────────┘
```

Hard rules:
- **The provider is dumb about fan-out and naming.** Suffixes, description hints, and the multi-connection loop all live in the runtime layer.
- **Adapters never expose their SDK's vocabulary upward.** Translation happens inside the adapter, once.
- **Core never parses provider strings.** `connectionId`, `authId`, tool slugs are opaque.

---

## 3. Core types

All in a new shared module `packages/core/src/tool-provider/`.

```ts
// 3.1 Provider interface
interface IntegrationProvider {
  readonly id: string;                     // 'composio' in v1
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;

  listToolServices(): Promise<ToolService[]>;
  listTools(toolService: string): Promise<ToolDescriptor[]>;

  resolveTools(opts: ResolveToolsOpts): Promise<Record<string, MastraTool>>;

  authorize(opts: AuthorizeOpts): Promise<{ url: string; authId: string }>;
  getAuthStatus(authId: string): Promise<'pending' | 'completed' | 'failed'>;
  getConnectionStatus(
    opts: { items: Array<{ connectionId: string; toolService: string }> },
  ): Promise<Record<string, { connected: boolean }>>;

  getHealth(): Promise<ProviderHealth>;
}

// 3.2 Capabilities — asymmetric features without subclass checks
type ProviderCapabilities = {
  multipleConnectionsPerService: boolean;   // Composio: true
  batchConnectionStatus: boolean;
  reauthorizeReusesConnectionId: boolean;
};

// 3.3 Per-call shapes
type ResolveToolsOpts = {
  toolSlugs: string[];
  toolMeta: Record<string, { description?: string }>;
  connectionId: string;
  requestContext?: Record<string, unknown>;
};

type AuthorizeOpts = {
  toolService: string;
  connectionId: string;
  toolName?: string;
};

// 3.4 Connection (the storage primitive)
type Connection = {
  kind: 'author' | 'invoker' | 'platform';   // v1 writes 'author' only
  toolService: string;                        // denormalized for clarity
  connectionId: string;                       // provider-opaque OAuth bucket id
  label: string;                              // REQUIRED; UI display + tool-name suffix
};

// 3.5 Stored shape per provider
type ProviderConfig = {
  tools: Record<string, { description?: string }>;
  connections: Record<string, Connection[]>;   // key = toolService
};

// 3.6 On the agent
type IntegrationTools = Record<string /* providerId */, ProviderConfig>;
```

### 3.7 Validation rules (Zod)

```ts
const ConnectionSchema = z.object({
  kind: z.enum(['author', 'invoker', 'platform']),
  toolService: z.string().min(1),
  connectionId: z.string(),
  label: z.string().min(1).max(32).regex(/^[A-Za-z0-9 _-]+$/),
}).passthrough();
```

- `label`: required, non-empty, ≤32 chars, regex `[A-Za-z0-9 _-]+`.
- `label`: **case-insensitive unique** within `connections[toolService]` (original case preserved for display).
- `kind` in v1: always `'author'` on write; schema accepts all three for forward-compat.
- `connectionId`: required for `author` / `platform`; reserved/empty for `invoker` (v1.5).
- Tool-name suffix derived from `label` (sanitized + uppercased).

### 3.8 Schema evolution rules

- **Additive-only.** New fields are always optional.
- **No version field.** Zod `.passthrough()` on connection + provider-config preserves unknown fields across releases.
- **Field semantics never change.** New meaning ⇒ new field name.
- **Removing a field is not allowed in v1.x.**

---

## 4. BaseIntegrationProvider

Shared abstract class. Provides allowlist + glob filtering for free; replaces the previously proposed `FilteredToolProvider` wrapper.

```ts
abstract class BaseIntegrationProvider implements IntegrationProvider {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly capabilities: ProviderCapabilities;

  constructor(protected opts: {
    allowedToolServices?: string[];      // exact match
    allowedTools?: string[];              // glob: "Gmail.*", "gmail.fetch_*"
  } = {}) {}

  async listToolServices() {
    const all = await this.fetchToolServices();
    return this.applyToolServiceFilter(all);
  }

  async listTools(toolService: string) {
    if (!this.isToolServiceAllowed(toolService)) return [];
    const all = await this.fetchTools(toolService);
    return this.applyToolFilter(all);
  }

  // Required: SDK-specific fetch
  protected abstract fetchToolServices(): Promise<ToolService[]>;
  protected abstract fetchTools(toolService: string): Promise<ToolDescriptor[]>;

  // Required: provider-specific runtime + auth
  abstract resolveTools(opts: ResolveToolsOpts): Promise<Record<string, MastraTool>>;
  abstract authorize(opts: AuthorizeOpts): Promise<{ url: string; authId: string }>;
  abstract getAuthStatus(authId: string): Promise<'pending' | 'completed' | 'failed'>;
  abstract getConnectionStatus(opts: {
    items: Array<{ connectionId: string; toolService: string }>;
  }): Promise<Record<string, { connected: boolean }>>;
  abstract getHealth(): Promise<ProviderHealth>;

  // Shared filter helpers
  private isToolServiceAllowed(slug: string): boolean { /* ... */ }
  private applyToolServiceFilter(items: ToolService[]): ToolService[] { /* ... */ }
  private applyToolFilter(items: ToolDescriptor[]): ToolDescriptor[] { /* glob */ }
}
```

Constructor usage:

```ts
new ComposioToolProvider({
  apiKey: '...',
  allowedToolServices: ['gmail', 'slack'],
});
```

- **One config site per provider.** No wrapper layer.
- **Glob matching written once.** Provider can't forget to filter.
- **Provider-specific options** live in the subclass constructor — never on the interface.

---

## 5. Registry

### 5.1 Registration

```ts
new Mastra({
  editor: new MastraEditor({
    toolProviders: [
      new ComposioToolProvider({
        apiKey: '...',
        allowedToolServices: ['gmail', 'slack'],
      }),
    ] as const,
  }),
});
```

- Flat array. No `registries.composio.*` nesting.
- Array order = tie-break when two providers expose the same `toolService` slug.
- **One provider instance per app**, reused by both the agent builder UI and runtime fan-out. Not two separate instances.
- `as const` is required at the callsite to preserve literal `id` types for compile-time lookups (§5.2). Forgetting it is harmless — `getToolProvider` degrades to a `string` parameter and `IntegrationProvider` return.

### 5.2 Typed accessor

`MastraEditor` is generic over the array so `getToolProvider` is type-safe.

```ts
class MastraEditor<
  TProviders extends readonly IntegrationProvider[],
> {
  constructor(opts: { toolProviders: TProviders });

  getToolProvider<TId extends TProviders[number]['id']>(
    id: TId,
  ): Extract<TProviders[number], { id: TId }>;
}
```

Each provider declares `readonly id` as a literal:

```ts
class ComposioToolProvider extends BaseIntegrationProvider {
  readonly id = 'composio' as const;
  readonly displayName = 'Composio';
  // ...
}
```

Callsite behavior:

```ts
editor.getToolProvider('composio')   // ✅ typed as ComposioToolProvider
editor.getToolProvider('cmposio')    // ❌ TS error — typo caught at compile time
```

Why generic array over an object map:
- **Order matters.** Two providers can expose the same `toolService` slug (`gmail`). Array order = deterministic tie-break.
- **Multiple instances of the same provider type.** Two `ComposioToolProvider`s with different `allowedToolServices` is legal; an object map blocks it via key collision.
- **Single source of truth for ids.** The instance owns the id; no key/id pair to keep in sync.
- **Open to third-party providers.** Anyone can publish a `MyToolProvider` with `readonly id = 'my-thing' as const` and it slots in.

### 5.3 Runtime invariants

`MastraEditor` validates on construction:

- **No duplicate ids.** Throws `DuplicateProviderError(id)` if two entries share `provider.id`.
- **Unknown id on `getToolProvider`** throws `UnknownProviderError(id, knownIds)` rather than returning `undefined`. Callers shouldn't need defensive `if (!provider)` checks for first-party code; external surfaces (HTTP, LLM) already validate ids before reaching the registry.

---

## 6. Storage on the agent

```ts
storedAgent.integrationTools = {
  composio: {
    tools: {
      'gmail.fetch_emails': { description: '...' },
      'gmail.send_email':   { description: '...' },
    },
    connections: {
      gmail: [
        { kind: 'author', toolService: 'gmail', label: 'Work',     connectionId: 'ca_work' },
        { kind: 'author', toolService: 'gmail', label: 'Personal', connectionId: 'ca_home' },
      ],
    },
  },
};
```

- `connections[toolService]` is the unit of OAuth identity for all tools belonging to that `toolService`.
- Multiple connections on the same `toolService` = multi-account.
- `toolService` is denormalized onto each `Connection` for clarity (callsites don't need the map key).
- Empty `connections[toolService]` is invalid when `tools` contains a slug from that `toolService` (save blocked).

---

## 7. Server routes

Provider-neutral. Server is intentionally dumb about provider-specific semantics.

```
GET  /api/tool-providers                              list configured providers
GET  /api/tool-providers/:id/tool-services            list allowed tool services
GET  /api/tool-providers/:id/tools?toolService=...    list allowed tools
POST /api/tool-providers/:id/authorize                start OAuth → { url, authId }
GET  /api/tool-providers/:id/auth-status/:authId      poll auth flow
POST /api/tool-providers/:id/connection-status        batch connection check
GET  /api/tool-providers/:id/health                   provider health
```

`connection-status` is POST because the body carries an array of `(connectionId, toolService)` pairs.

---

## 8. Runtime fan-out

`resolveStoredIntegrationTools(integrationTools, requestContext)` is generic — no provider branches.

```
for providerId in integrationTools:
  cfg = integrationTools[providerId]
  provider = registry.get(providerId)

  for toolService in cfg.connections:
    conns     = cfg.connections[toolService]
    toolSlugs = tools in cfg.tools whose slug belongs to toolService
    skipSuffix = conns.length === 1

    for connection in conns:
      resolved = await provider.resolveTools({
        toolSlugs,
        toolMeta: cfg.tools,
        connectionId: connection.connectionId,
        requestContext,
      });

      suffix = skipSuffix ? '' : '__' + buildConnectionSuffix(connection, usedSuffixes);
      for [slug, tool] of resolved:
        desc = tool.description;
        if (!skipSuffix) desc = `${desc}\n\nRoutes through connection: ${connection.label}`;
        out[slug + suffix] = { ...tool, id: slug + suffix, description: desc };
```

### 8.1 LLM-visible shape

Two connections on `gmail` with two tools selected → four tools to the LLM:

```
gmail.fetch_emails__WORK       (description ends: "Routes through connection: Work")
gmail.fetch_emails__PERSONAL
gmail.send_email__WORK
gmail.send_email__PERSONAL
```

- The provider's `resolveTools` only sees one connection at a time and the **original** slug. The suffix lives only in Mastra's tool registry.
- Single-connection `toolService`s skip the suffix entirely (natural slug).
- The description hint is what the LLM routes on; the suffix is Mastra's dispatch key.
- Required + unique labels are load-bearing — bad labels mean bad LLM routing.

### 8.2 `buildConnectionSuffix`

1. Sanitize `label`: uppercase, strip non-`[A-Z0-9_]`.
2. On collision with `usedSuffixes`, append `_2`, `_3`, ...
3. Reserve `INVOKER` for v1.5 invoker connections; `PLATFORM` not used in v1.
4. Empty/invalid label is impossible (validated upstream).

### 8.3 Composio mapping cheatsheet

| Concept                         | Composio                                          |
| ------------------------------- | ------------------------------------------------- |
| `connectionId`                  | `connectedAccountId` (`ca_xxx`)                   |
| Multi-account / human           | multiple `ca_xxx` under same Composio account     |
| Per-call routing                | injected via `beforeExecute`                      |
| Authorize entrypoint            | `initiateConnection` → URL                        |
| Auth status                     | `listConnections` filter                          |
| `multipleConnectionsPerService` | `true`                                            |

---

## 9. UI

### 9.1 Tools panel (single, provider-neutral)

- One "Tools" section in the agent builder. **No provider tabs.**
- Add-tools dialog lists tool services across all configured providers; each tool row shows a provider chip.
- Each tool-service row has an inline connection picker (multi-select) co-located with its tool list. No separate page, no modal/drawer.
  - "+ Add connection" mints a `connectionId` and opens the OAuth popup.
  - Each connection row has a required `label` input.
  - Inline validation: required, ≤32 chars, regex, case-insensitive unique.
  - If `provider.capabilities.multipleConnectionsPerService === false`, the picker caps at one connection per service.
- **Empty state, not placeholder row.** When a tool service has no connections yet, the row shows "⚠ Not connected" with an "+ Add connection" button. We do **not** insert a placeholder connection with empty `connectionId`/`label` (would violate the schema).
- Form save blocked while any tool-service-with-tools has zero connections.
- No mode toggle in v1 (all author).

### 9.2 Authorize flow

```
Picker → onAuthorize(toolService, connectionId)
  → POST /api/tool-providers/:id/authorize { toolService, connectionId }
  → { url, authId }
  → open popup
  → poll GET /auth-status/:authId until 'completed'
  → refresh connection-status (batched) → row marks "Connected"
```

**Re-authorize** (token expired/revoked):
- Disconnected row shows "Reauthorize" (not "+ Add connection").
- Calls `authorize()` with the **existing** `connectionId` → token refreshes in place at the SDK level.
- Connection row is unchanged on the agent; no orphaning.
- Capability flag: only shown if `provider.capabilities.reauthorizeReusesConnectionId === true`. Otherwise UI forces delete + add.

**Switching accounts** is *not* re-auth:
- Trash existing connection → "+ Add connection" → mints a new `connectionId`.
- Forces explicit intent.

### 9.3 Health pill

Per-agent pill in the Tools panel header.

```
[ Composio ✓ ]
  click ↓
  Gmail     ✓ 2 connected
  Slack     ⚠ 1 of 2 connected — "Personal" disconnected
  Calendar  ✕ 0 connected
```

- One batched `getConnectionStatus(items)` call per provider on panel open.
- `items` = every `(connectionId, toolService)` pair currently bound on the agent.
- Top-level chip = provider-level rollup (`✓` / `⚠` / `✕`).
- Popover row per tool service shows `n of m connected`; disconnected rows link to §9.2's reauthorize flow.

---

## 10. agentBuilderTool surface

LLM-facing tool that lets the builder agent add integration tools to an agent.

```ts
integrations: {
  add?: Array<{
    providerId: 'composio';
    toolSlug: string;
  }>;
  remove?: Array<{ providerId: string; toolSlug: string }>;
}
```

- Builder agent **never writes `label` or `connectionId`** — those are human-only inputs.
- Adding a tool whose tool service has no connections → the UI surfaces the "needs auth" empty state until the human authorizes.
- No `authMode` field at all.

---

## 11. Connect-required marker (deferred — v1.5)

When invoker mode lands, the unified tool-result shape is:

```json
{
  "error": true,
  "__connectRequired": true,
  "providerId": "composio",
  "toolService": "gmail",
  "connectionId": "...",
  "message": "..."
}
```

One detector in `tool-fallback.tsx`, one `ConnectRequiredBadge` component, no per-provider variants. Not built in v1.

---

## 12. What v1 drops from the prototypes

- `BindingModeToggle` and `AgentAuthModeRadio` (no kind/mode toggle in v1).
- `ComposioConnectRequiredBadge` (v1.5; will return as one generic badge).
- `useComposioConnectBridge`, `useComposioConnections`, `connect-link-modal` (replaced by generic equivalents).
- Composio's `registries.composio.*` config (folded into `BaseIntegrationProvider` constructor opts).
- Memory `resourceId` per-mode switch (lives with invoker mode in v1.5).
- `authMode` / `authIdentity` storage fields (deleted, not just hidden).
- `connectionsByToolkit`, `bindings` storage keys (replaced by `connections`).
- `ConnectionPin` / `ConnectionBinding` legacy types (no migration; prototype data is throwaway).
- Composio-specific noun "toolkit" throughout core/server types (replaced by `toolService`).

---

## 13. Adapter design principles

Codifying the rules that produced this spec — apply when adding the next provider.

1. **Name from the consumer, not the vendor.** Pick terms the agent builder UI uses, not what any one SDK uses.
2. **Lowest-common-denominator surface.** A method goes on the interface only if every provider can implement it. Anything provider-specific lives behind a capability flag or in the adapter constructor.
3. **Capabilities over inheritance.** UI/runtime reads `provider.capabilities`; no `if (provider instanceof ComposioX)`.
4. **Opaque identifiers across the boundary.** Core never parses `connectionId`, `authId`, or tool slugs.
5. **Provider owns its vocabulary internally.** Inside `ComposioToolProvider`, call it `connectedAccountId`. At the interface, translate to `connectionId`. The mapping table lives in one place — the adapter.
6. **Errors are structured, not stringly-typed.** `class ConnectionRequiredError extends ProviderError { providerId; toolService; connectionId }`. Consumers match on type, not message regex.
7. **No leaky options bag.** No `Record<string, unknown>` "passthrough" options at the interface. Provider-specific knobs go in the subclass constructor.
8. **Versioned capabilities, not versioned interfaces.** Adding a feature = adding a capability flag, not a new interface version.

---

## 14. Auth dependency (OSS / no-RBAC mode)

v1 is **author-only**, so the only identity that matters is the agent's `authorId`. When the host app has no auth provider configured, there is no `currentUser` to derive that from.

**Rule:**

```
authorId =
  storedAgent.authorId          // set at create time when auth is present
  ?? currentUser?.id            // host injected identity
  ?? 'default'                  // OSS / no-auth fallback constant
```

`'default'` is reserved — it's an opaque string to providers (Composio sees it as just another `userId`), and v1.5's `invoker` mode must never collapse to it silently.

**Implications:**

- **Single-tenant OSS dev:** all agents in a project share one Composio bucket per `toolService`. This matches the "one developer, one laptop" mental model.
- **Re-auth is safe:** Composio re-uses `ca_xxx` per `(userId, toolService)`. Adding auth later does not invalidate existing `'default'`-scoped connections — they just continue to live under `userId='default'`.
- **Memory `resourceId`:** unchanged for v1 (`agentId`). The author-only design means there is no per-user memory split to worry about. v1.5 introduces the invoker `resourceId` switch.
- **Connection picker UI:** the OAuth flow uses `authorId` ( = `'default'` in OSS) for the `userId` passed to `initiateConnection`. The user never sees the constant.

**v1.5 / invoker mode:** will hard-require an auth provider. UI hides the `invoker` toggle and the server rejects invoker-mode bindings when `currentUser` is unresolvable. Never falls back to `'default'` for invoker — that would silently collapse per-user isolation to a shared bucket.

---

## 15. Phasing summary

| Phase | Adds                                                                            | Reuses from v1                       |
| ----- | ------------------------------------------------------------------------------- | ------------------------------------ |
| v1    | Provider interface, `BaseIntegrationProvider`, registry, generic routes, storage, UI, fan-out, health pill | —                                    |
| v1.5  | `kind: 'invoker'` in UI, `__connectRequired` marker + badge, memory `resourceId` switch, auto-retry, white-label OAuth (Composio `authConfigs`, `callbackUrl`), additional adapters (e.g. Arcade) | All of v1                            |
| v2    | `kind: 'platform'` (admin-gated), per-tool overrides (key changes from `toolService` to `toolSlug`) | All of v1, v1.5                      |

---

## 16. Glossary

| Term              | Meaning                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| Provider          | An integration source — the adapter instance. Composio in v1.           |
| `toolService`     | A bundle of tools sharing one OAuth boundary (Gmail, Slack).            |
| Tool              | An individual slug under a tool service (`gmail.fetch_emails`).         |
| Connection        | A `{ kind, toolService, connectionId, label }` row identifying one OAuth bucket. |
| `connectionId`    | Provider-opaque string. Composio: `ca_xxx`.                             |
| Author            | The user who created/owns the agent.                                    |
| Invoker           | The end user calling the agent at runtime (v1.5).                       |
| Platform          | A shared / service account (v2).                                        |
| Suffix            | LLM-visible tool-name disambiguator (`__WORK`).                         |
| Routing hint      | Description sentence appended for the LLM (`Routes through connection: Work`). |
| Capability flag   | Boolean on `provider.capabilities` describing asymmetric features.      |
| `'default'`       | Reserved opaque `authorId` used in OSS / no-auth setups. Single shared bucket per `toolService` for the whole project. |
