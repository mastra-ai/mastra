# Composio SDK pinned at `^0.6.5` — upgrade blocked by `$ref` regression

## TL;DR

- `@composio/core` and `@composio/mastra` are pinned at **`^0.6.5`** (resolves to `0.6.11`) in `packages/editor/package.json`.
- Bumping to `0.9.x` / `0.10.x` breaks **all Composio tools with internal `$ref` schemas** (gmail, github, google calendar, etc.) at runtime.
- Root cause: Composio API returns tool schemas with dangling `$ref` pointers to `$defs` that are never included in the response. `@composio/mastra@0.9.x+` calls a new strict `dereferenceJsonSchema()` walker that throws on the unresolvable ref. `0.6.x` did not call this walker and silently tolerated it.
- We are also still on the deprecated `composio.connectedAccounts.initiate()` API. It sunsets **July 3, 2026**.

## Why we did not upgrade

| Approach                                              | Verdict                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Bump core + mastra to `^0.10.0` / `^0.9.2`            | ❌ All typed Composio tools fail with `Cannot resolve $ref #/$defs/<Name>` at `tools.get()`. |
| Fork `MastraProvider` locally                         | ❌ Rejected — avoid forking third-party code.                                                |
| Bypass `@composio/mastra`, use `createTool()` directly | ⚠️ Viable; large rewrite of `composio.ts`.                                                   |
| `pnpm patch @composio/mastra`                          | ⚠️ Viable; carries a `.patch` file in repo, auto-applied on install.                          |
| Monkey-patch `dereferenceJsonSchema`                   | ❌ Fragile.                                                                                  |
| Downgrade `@composio/mastra` only, keep core `0.10.x`  | ❌ Peer dep mismatch.                                                                        |
| **Stay on `^0.6.5` and wait for upstream fix**        | ✅ Chosen. Lowest risk, all tools work today.                                                |

## Diagnostic evidence

Raw tool from Composio API (`getRawComposioTools`) for `GITHUB_LIST_BRANCHES`:

```json
{
  "name": "GITHUB_LIST_BRANCHES",
  "inputParameters": { ... },
  "outputParameters": {
    "properties": {
      "data": { "$ref": "#/$defs/ListBranchesResponse" }
    }
  }
  // ← no `$defs` block anywhere on the tool
}
```

`@composio/mastra@0.9.x+` `MastraProvider.wrapTool()` (`dist/index.mjs` lines 59, 64) calls:

```js
dereferenceJsonSchema(tool.inputParameters);
dereferenceJsonSchema(tool.outputParameters);
```

`$ref` resolution walks from the sub-schema root → never finds `$defs` → throws → entire `tools.get()` call rejects → `resolveStoredToolProviders` catches and skips the toolkit → agent runs with zero Composio tools.

`@composio/mastra@0.6.11` does not call `dereferenceJsonSchema` at all, so it silently passes the schema through with the dangling ref intact (downstream consumers handle it).

## Action items (do not forget)

### P0 — before July 3, 2026 (sunset of `initiate()`)

- [ ] Track upstream Composio fix for `$ref`/`$defs` resolution in `MastraProvider.wrapTool`.
  - Likely path: report issue to `composiohq/composio` so the API includes `$defs` on the tool root, or so `dereferenceJsonSchema` resolves from the tool root instead of each sub-schema.
- [ ] Once fixed: bump both packages to the patched version, migrate `composio.connectedAccounts.initiate()` → `.link()`.
- [ ] Verify with multi-toolkit smoke (gmail, github, google calendar) before merging the bump.

### P1 — if upstream is not fixed by ~June 2026

Pick one fallback (in order of preference):

1. **`pnpm patch @composio/mastra`** — wrap the `dereferenceJsonSchema` calls in try/catch, or hoist `$defs` resolution to the tool root before walking. Commit the `.patch` file; `pnpm` auto-applies on install.
2. **Bypass `@composio/mastra`** — use `getRawComposioTools()` + Mastra's `createTool()` directly in `packages/editor/src/providers/composio.ts`. Bigger rewrite, but no third-party patch to maintain.

### P2 — when bumping

- [ ] Migrate `initiate()` → `link()` in `packages/editor/src/providers/composio.ts`.
  - `link()` takes `(userId, authConfigId, { allowMultiple, callbackUrl?, alias?, experimental? })`.
  - `link()` has **no `config` field** — pre-auth fields (e.g. Confluence subdomain) need a different path. Audit non-OAuth toolkits before flipping.
- [ ] Update `composio.test.ts` mock surface from `initiate` → `link`.

## Files involved when re-attempting the bump

- `packages/editor/package.json` — version pins
- `packages/editor/src/providers/composio.ts` — `initiate()` / `link()` call site, `MastraProvider` instantiation, `resolveToolsV2`
- `packages/editor/src/providers/composio.test.ts` — mock surface
- `packages/core/src/tool-provider/runtime.ts` — `resolveStoredToolProviders` (catches and skips on resolution failure; useful as the smoke-test signal)

## Current pin state (as of May 28, 2026)

```json
// packages/editor/package.json
"@composio/core": "^0.6.5",   // resolves to 0.6.11
"@composio/mastra": "^0.6.5"  // resolves to 0.6.11
```

Last bump attempted: `0.10.0` / `0.9.2` — reverted same day.
