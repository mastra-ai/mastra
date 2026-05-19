# Model Policy Surfaces

The Mastra model policy controls which provider+model pairs end users can pick
in the agent UI. Until this change the policy was a single global object
attached to the `AgentBuilder` config, and the shared `LLMProviders` /
`LLMModels` leaf components read it directly. That meant the builder allowlist
silently leaked into every other dropdown — the CMS agent editor, the chat
composer, and any future host that mounts those leaves.

This doc describes the new surface-scoped policy model and how to add new
surfaces later.

## Surfaces

A "surface" is a UI context that asks the server for its current model policy.
Today there are two:

| Surface  | Where it mounts                        | Source                                    |
| -------- | -------------------------------------- | ----------------------------------------- |
| `builder`| `/agent-builder/agents/*`              | `editor.builder.modelPolicy` (existing).  |
| `editor` | CMS agent edit + create (`/cms/agents/*`)| Hardcoded inactive for now.             |

Hosts can still configure `editor.builder.modelPolicy` exactly as before. That
allowlist now applies **only to the builder surface**.

## End-to-end shape

1. **Server resolver.** `resolveModelPolicy({ editor, surface })` lives in
   `@mastra/server/server/utils/resolve-model-policy`. For `builder` it reads
   `editor.builder.modelPolicy`; for `editor` it always returns
   `{ active: false }`. A future PR will replace that branch with a real source
   (e.g. `editor.editorAgents.modelPolicy`).
2. **HTTP.** `GET /editor/settings/model-policy?surface=builder|editor` returns
   the resolved policy. The existing `GET /editor/builder/settings` still
   returns the builder slice for backwards compatibility.
3. **Client.** `MastraClient#getModelPolicy({ surface })` calls the new route.
   `ModelPolicy` is re-exported alongside the now-deprecated
   `BuilderModelPolicy` alias.
4. **React.** `ModelPolicyProvider` (in `@internal/playground/src/domains/llm`)
   fetches the policy with TanStack Query and exposes it through
   `useModelPolicy()`. The builder and CMS shells mount the provider with their
   surface; all leaf consumers (`LLMProviders`, `LLMModels`, metadata switcher,
   composer switcher, configure panel, allowed-models hook, filtered-models
   hook) read it via the hook. Outside a provider the hook returns
   `{ active: false }`, so non-shell consumers degrade safely.
5. **Save path.** The `POST /editor/stored-agents` handler no longer enforces
   the policy. UI gating is the source of truth until each surface has its own
   source. Save-path enforcement will return when we add per-surface storage.

## Adding a new surface

1. Extend the `ModelPolicySurface` union in `@mastra/core/agent-builder/ee`.
2. Add a branch to `resolveModelPolicy` that reads from your config slot.
3. Mount `<ModelPolicyProvider surface="your-surface">` at the route shell.
4. Update the changeset and this doc.

The leaves do not need to change — they already read whatever surface their
nearest provider declares.

## Future work

- Replace the hardcoded inactive branch for `editor` with a real config slot
  (`editor.editorAgents.modelPolicy` is the working name).
- Re-enable save-path enforcement once both surfaces have storage.
- Remove the `BuilderModelPolicy` / `isBuilderModelPolicyActive` /
  `useBuilderModelPolicy` aliases in vNext.
