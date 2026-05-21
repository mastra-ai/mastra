---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@internal/playground': minor
---

Scope `BuilderModelPolicy` to surfaces (`builder` / `editor`) and stop leaking
the builder allowlist into non-builder UIs.

Previously the builder admin model allowlist was applied to every shared
`LLMProviders` / `LLMModels` dropdown — including the CMS agent editor and
chat composer — because the leaf components read `useBuilderModelPolicy()`
directly. Hosts that configured `editor.builder.modelPolicy` saw the policy
silently filter dropdowns outside the builder.

This release introduces a surface-aware model policy:

- New `ModelPolicy` type and `isModelPolicyActive` helper on
  `@mastra/core/agent-builder/ee`. `BuilderModelPolicy` /
  `isBuilderModelPolicyActive` remain as `@deprecated` aliases.
- New `GET /editor/settings/model-policy?surface=builder|editor` route on
  `@mastra/server`. The `editor` surface currently returns an inactive policy
  (`{ active: false }`); a real editor-side source will land in a follow-up.
- The save handler in `POST /editor/stored-agents` no longer enforces the
  builder model allowlist — UI gating is the source of truth for now.
- New `ModelPolicyProvider` + `useModelPolicy` in
  `@internal/playground` (`src/domains/llm`). The builder and CMS edit shells
  mount the provider with their surface; non-builder consumers now read an
  inactive default and stop being filtered.
- `@mastra/client-js` gains a `getModelPolicy({ surface })` method and a
  re-exported `ModelPolicy` type.

No storage migration is required. Builder model policy semantics are
unchanged inside the builder UI.
