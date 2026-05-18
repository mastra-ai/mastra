# Phase 7 — Per-Binding Auth Modes (`platform` / `author` / `invoker`)

> **Status:** Proposed (post-prototype)
> **Depends on:** Phases 1–5 landed, Phase 6 (Ops) in flight
> **Goal:** Replace single-mode platform-user auth with **per-binding auth modes**, defaulting new agents to **invoker** mode while keeping `platform` as an explicit, admin-gated fallback for service accounts / system invocations.

---

## TL;DR

- Today every Composio call uses one shared `platformUserId`. This blocks per-user audit, RBAC, and team-shared agents.
- Long-term shape: **per-binding** `kind`, not per-agent or per-registry mode.
- Three resolvable kinds: `platform` (shared service account), `author` (agent creator), `invoker` (caller at runtime).
- Pin storage moves from `connectedAccountId`-keyed to **intent-keyed** so agents become portable across users.
- Ships in **4 sub-phases** that each go to main independently and behaviour-compatible by default.

---

## Background

Phase 5 settled on `resolveComposioUserId({ registry })` returning `registry.platformUserId` for every invocation. Pins store `connectedAccountId` directly. This works for the prototype but has three structural limitations:

1. **No per-user audit.** Composio dashboard shows one shadow user. Revoking a single human's access is impossible.
2. **Agent portability is fake.** A pin like `ca_xxx` only works because everyone is the same Composio user. The moment we split, exported agents break.
3. **Workspaces are not single-philosophy.** Real deployments mix personal assistants, team-shared agents, and shared service-account bots. A single global mode forces fragmentation.

The fix is to make the auth source a **first-class property of each tool binding**, with the runtime resolving the source per invocation.

---

## End-state model

### Storage (per stored agent)

```ts
type ConnectionBinding =
  | { kind: 'platform'; connectedAccountId: string }              // service account, admin-gated
  | { kind: 'author'; connectedAccountId: string }                // pinned at author-time under author's Composio user
  | { kind: 'invoker' };                                          // BYO — account resolved per-caller at runtime

type StoredMCPClientToolsConfig = {
  // …existing fields…
  bindings?: Record</* toolkit slug */ string, ConnectionBinding[]>;
  // legacy: `connectionsByToolkit` kept readable for migration only
};
```

- `bindings` replaces `connectionsByToolkit` long-term.
- Each toolkit can have multiple bindings (multi-account fan-out, retained from Phase 5).
- `kind` is the only required discriminator; `label`, `role`, and per-tool overrides come later.

### Resolution (per invocation)

```ts
resolveComposioBinding(
  binding: ConnectionBinding,
  ctx: { registry: ResolvedComposioRegistry; agent: StoredAgent; invokerId?: string }
): { userId: string; connectedAccountId?: string; source: 'platform' | 'author' | 'invoker' };
```

- `platform` → `{ userId: registry.platformUserId, connectedAccountId: binding.connectedAccountId, source: 'platform' }`
- `author`   → `{ userId: agent.authorId, connectedAccountId: binding.connectedAccountId, source: 'author' }` — pin is set at author-time, scoped to the author's Composio user. Determined, not looked up per run.
- `invoker`  → `{ userId: ctx.invokerId, source: 'invoker' }` — throws `ConnectionRequiredError` if no active account. **No silent fallback** — falling back to `platform` would swap identity without the invoker's knowledge and break attribution. If shared-account behaviour is also wanted, add an explicit second `platform` binding to the same toolkit; multi-account fan-out exposes both as renamed tools and the agent picks.

**Why `author` pins (and `invoker` doesn't):**
- `platform` and `author` both have a known Composio user at save time, so the pin is deterministic — same account every run.
- Without pinning `author`, a multi-account author gets non-deterministic routing, and connecting a new account later would silently change the agent's behaviour (same identity-swap risk we rejected for `invoker` fallback).
- `invoker` is the only late-bound kind, because the caller isn't known until runtime.

`ComposioToolProvider.resolveTools` fans out per binding the same way it fans out per pin today.

### Default for new agents

`invoker` with no fallback. `platform` and `author` remain available behind an "Advanced auth" toggle.

---

## Why per-binding, not per-agent or per-registry

| Granularity | Pros | Cons |
|-------------|------|------|
| Per-registry (admin-wide) | Single config | Workspaces fragment; no mixed agents |
| Per-agent | Author chooses | Breaks hybrid agents (read shared inbox, write as me) |
| **Per-binding** | Models reality 1:1 | Slightly more storage + UI |

A per-agent `authMode` enum is fine as a **UX shortcut** that bulk-sets every binding, but storage must be per-binding so we don't migrate again.

---

## Acceptance truths (across all sub-phases)

- [ ] Existing agents continue to run with no migration step required. Legacy `connectionsByToolkit` shape is auto-normalized to `bindings: [{ kind: 'platform', connectedAccountId }]` on read.
- [ ] New agents default to `invoker` bindings.
- [ ] `platform` bindings can only be created/edited by users with an admin-level permission; non-admin authors see the option disabled with a tooltip.
- [ ] `platform` and `author` bindings carry an explicit `connectedAccountId`; `invoker` bindings have none (late-bound at runtime).
- [ ] Runtime throws `ConnectionRequiredError` (recoverable, not 500) when an `invoker` binding has no active account.
- [ ] Agent runner UI catches `ConnectionRequiredError` and surfaces a Connect Link inline — same bridge as the builder.
- [ ] Composio health pill becomes user-scoped: shows the **invoker's** perspective when viewing an agent that uses invoker bindings.
- [ ] `getComposioHealth` accepts an optional `userId` and reports for that user; defaults to platform when omitted.
- [ ] Multi-account fan-out from Phase 5 still works inside each `kind`.
- [ ] All Phase 5 tests still pass with `kind: 'platform'` as the migrated default.

---

## Sub-phases

Each sub-phase is independently shippable. Default behaviour stays unchanged until 7.4 flips the new-agent default.

### 7.1 — Storage + binding model (no behaviour change)

**Scope**
- Add `bindings` field to `StorageMCPClientToolsConfig` (core + client-js + server schemas).
- Add `ConnectionBinding` discriminated union to `@mastra/core/agent-builder/ee`.
- Extend the normalizer: legacy `connectionsByToolkit: Record<toolkit, ConnectionPin[] | string>` → `bindings: Record<toolkit, ConnectionBinding[]>` with `kind: 'platform'`.
- Update Zod schemas in `packages/server/src/server/schemas/stored-agents.ts` and `agent-versions.ts` to accept both shapes (`z.union` with preprocess).
- Update `ComposioToolProvider.resolveTools` to consume `bindings` and route `kind: 'platform'` to current behaviour. No new kinds yet.
- Add unit tests for the normalizer (10+ cases covering legacy string, legacy array, mixed, missing).

**Out of scope**
- UI changes
- `author` / `invoker` resolution
- Default flip

**Acceptance**
- All existing Phase 5 tests pass without modification (legacy shape still works).
- Storage round-trip: legacy agent loaded → saved → reloaded retains semantics (auto-upgraded to `bindings`).
- New `bindings` shape can be saved and reloaded as-is.

**Verification**
```
pnpm --filter ./packages/core typecheck
pnpm --filter ./packages/core test composio
pnpm --filter ./packages/editor test composio
pnpm --filter ./packages/server test editor-builder-composio
```

---

### 7.2 — `author` mode end-to-end

**Scope**
- Extend `resolveComposioUserId` to take `{ binding, agent, registry }` and route by `kind`.
- For `kind: 'author'`: read `agent.authorId` (already on stored agents — verify field exists end-to-end; add if missing). The pinned `connectedAccountId` from the binding is used directly; no per-run account lookup.
- Builder pins the author's chosen account at save time via `AccountPicker` (filtered to the author's active Composio accounts).
- If the pinned account is revoked or deleted at runtime: throw `ComposioConnectionRevokedError` (existing Phase 5 error); surface in builder UI with a "re-pin" CTA.
- Builder UI: add an "Auth mode" toggle on the Tools row. Three options shown, **but `invoker` disabled with tooltip "coming soon"** until 7.3.
- AccountPicker scopes to the relevant user (`author` → author's accounts).
- `getComposioHealth` gains optional `userId` param; pill on builder shows author's view when any binding is author-mode.

**Out of scope**
- `invoker` runtime
- Hybrid per-tool bindings

**Acceptance**
- Author who has connected Gmail can author an agent in `author` mode; runtime sends emails from author's account.
- Author who hasn't connected Gmail sees a "Connect Gmail" CTA inline; clicking opens Connect Link bridge.
- Switching mode from `platform` → `author` preserves selected tools and re-runs `AccountPicker` against the author's accounts to pin a fresh `connectedAccountId` (does not silently reuse the platform pin).
- Health pill reflects author's connection state.

**Verification**
```
pnpm --filter ./packages/editor test composio
pnpm --filter ./packages/playground test agent-builder
pnpm --filter ./packages/server test editor-builder-composio
```

Manual: smoke-test from `examples/agent-builder` — create author-mode agent, run it, verify Composio dashboard logs the author's user.

---

### 7.3 — `invoker` mode + recoverable error UX

This is the heaviest sub-phase. **Budget 60% of the migration effort here** — the runtime change is small, the UX is the work.

**Scope**
- Plumb `invokerId` into the agent runtime call path. Source: the request context that already carries `MASTRA_RESOURCE_ID_KEY` (already wired in Phase 5, just unused for this purpose).
- Add `ConnectionRequiredError` (recoverable). Maps to a structured HTTP response, not a 500.
- `ComposioToolProvider`:
  - When `kind: 'invoker'`: resolve to `ctx.invokerId`, look up active accounts, throw `ConnectionRequiredError` if none.
  - No silent fallback. If shared-account behaviour is wanted alongside invoker, the author adds a second `platform` binding explicitly.
- Agent runner UI (chat surface):
  - Catch `ConnectionRequiredError` mid-stream → render a "Connect Gmail to continue" inline action.
  - Reuse `ConnectLinkModal` from Phase 4.
  - On successful connect → retry the failed tool call automatically.
- Builder UI: enable the `invoker` option in the mode toggle. Show explanatory copy: "Anyone running this agent uses their own Gmail."
- Health pill: when viewing as an invoker, scope check to the invoker's accounts. Add an "invoker view" indicator if the pill is rendered outside an invocation context.

**Out of scope**
- Per-tool binding (mixed read/write modes) — saved for Phase 8.
- Bulk migration of existing agents to invoker mode.

**Acceptance**
- Alice creates an invoker-mode agent → Bob runs it. If Bob has Gmail connected, the email sends from Bob. If not, Bob sees an inline Connect prompt and the run resumes after.
- Alice revoking her Gmail does not break the agent for Bob.
- `getComposioHealth` for Bob accurately reports Bob's connection state.
- Mixed-mode fan-out: an agent with both `invoker` and `platform` bindings on the same toolkit exposes both as renamed tools (existing Phase 5 fan-out path).
- No 500s in normal "user not connected" path — all surface as recoverable UX.

**Verification**
```
pnpm --filter ./packages/editor test
pnpm --filter ./packages/playground test
pnpm --filter ./packages/server test
```

Manual: 2-user smoke test via `examples/agent-builder` — create as user A, run as user B, verify connect prompt and successful run.

---

### 7.4 — Default flip + `platform` becomes "Advanced"

**Scope**
- Flip default `kind` in builder UI: new agents default to `invoker`.
- Move `platform` option into an "Advanced" disclosure. Gate the option behind an admin permission (`composio:bind-platform` or similar).
- Update `agentBuilderTool` description + schema so the LLM creates `invoker` bindings by default. Add explicit hint that `platform` requires admin.
- Update docs: `tools.mdx`, `tool-provider.mdx`, ops runbook in `phase-6-ops.md`.
- Add a one-time non-blocking notice in Studio: "New agents now default to per-user auth. Existing agents are unchanged."

**Acceptance**
- New agent in builder defaults to `invoker` for every Composio tool toggled on.
- Authoring `platform` requires the admin permission; UI hides the option for non-admins.
- LLM-driven agent creation (chat) produces `invoker` bindings unless the prompt explicitly asks for a shared service account.
- Docs reflect the new default and admin gating.

**Verification**
```
pnpm --filter ./packages/playground test agent-builder
pnpm --filter ./packages/editor test
pnpm --filter ./docs lint:remark
```

Manual: create an agent as non-admin, confirm `platform` option is hidden. Confirm existing agents continue to use their stored `platform` bindings unchanged.

---

## Things explicitly deferred to Phase 8

- **Per-tool bindings.** Today's hybrid case (`GMAIL_FETCH_EMAILS` from shared inbox, `GMAIL_SEND_EMAIL` from invoker) requires moving the binding granularity from toolkit-level to tool-level. Worth doing once we have a real user with this need.
- **`role` semantics on bindings.** `{ role: 'primary' | 'sender' }` only matters once per-tool bindings exist.
- **Bulk migration UI** for converting existing `platform` agents to `invoker`. Migration script will exist; UI is non-goal for v1.
- **OAuth pre-warming.** "Connect everything I'll need before running" — nice-to-have, not blocking.

---

## Migration & rollback

**Forward**
- Legacy `connectionsByToolkit` keeps working forever — the read-path normalizer never goes away.
- New writes go to `bindings`. After 6 months we can stop writing the legacy field; reads stay backward-compatible.

**Rollback**
- Sub-phase 7.1 is pure additive — rolling back leaves agents in a valid pre-7.1 state.
- 7.2 and 7.3 introduce new `kind` values. Rollback strategy: feature-flag `bindings` consumption in `ComposioToolProvider` so we can disable new modes server-side without storage rollback.
- 7.4 is policy-only. Trivially reverted by flipping the default constant.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Invoker UX feels broken on first run ("why does the agent stop?") | High | Inline Connect prompt + auto-retry in 7.3; copy reviewed by design |
| Author connects, then leaves org → `author` agents break | Medium | Document; add admin migration tool in Phase 8 |
| Composio API rate limits with per-user lookups (no shared cache) | Medium | Add per-user account-list cache with short TTL; measure in 7.3 |
| Health pill becomes confusing across modes | Medium | Show explicit "your view" / "agent author's view" labels |
| Existing platform-mode agents accidentally migrated | High | Default flip is for **new** agents only; legacy agents untouched |
| Auth-config auto-discovery still platform-scoped | Low | Out of scope; documented limitation for v1 of Phase 7 |

---

## Handoff to next phase

Phase 8 picks up:
- Per-tool binding granularity
- Bulk migration tooling
- Removing the legacy `connectionsByToolkit` write path
- Connection-level RBAC (now trivial because bindings describe intent + ownership is per-user)

When 7.1–7.4 land, update `README.md` table and `REVIEW.md` to reflect the new auth surface.
