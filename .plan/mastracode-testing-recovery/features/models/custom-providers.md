# Custom OpenAI-compatible providers

## Origin PR / commit

- PR: [#13682](https://github.com/mastra-ai/mastra/pull/13682) — added `/custom-providers`, custom provider settings, model routing, and Harness custom model catalog support.
- Later changes: [#13611](https://github.com/mastra-ai/mastra/pull/13611) — preserves custom-provider precedence before gateway/built-in routing while tightening explicit gateway auth paths; [#14433](https://github.com/mastra-ai/mastra/pull/14433) — forwards Harness thread/resource headers into custom-provider `ModelRouterLanguageModel` construction so server-side memory enrichment receives identity context.

## User-visible behavior

- What the user can do: run `/custom-providers` to add, manage, edit, delete, and attach model IDs for OpenAI-compatible provider endpoints.
- Success looks like: configured custom provider models appear in `/models`/OM model selectors, route through the provider's base URL/API key with Harness thread/resource headers when available, and can be selected like built-in provider models.
- Must preserve: custom providers use slug IDs without a `custom-` prefix, provider model IDs are `provider-slug/model`, and custom providers win over built-in/gateway routing when IDs collide.

## Entry points / commands

- Commands / shortcuts / flags: `/custom-providers`; `/models` and `/om` consume the resulting catalog entries.
- Automatic triggers: `createMastraCode()` supplies `customModelCatalogProvider` and `modelAuthChecker` from `settings.customProviders`.

## TUI states

- Idle: `/custom-providers` opens modal questions/select lists for provider CRUD.
- Active / modal / error: modal flow validates URL format, prevents duplicate provider IDs, and shows info/error messages for mutations.

## Headless / non-TUI behavior

- Supported: model resolution and custom model catalog use `settings.json`; preconfigured providers can work headlessly.
- Not supported / unknown: creating/editing providers is TUI modal-driven.

## Streaming / loading / interrupted states

- Streaming / loading: custom provider selection is between-run model state; active model resolution uses the current settings snapshot when the run starts.
- Abort / retry / resume: interrupted provider-management modals do not persist partial answers; saved settings persist completed mutations immediately.

## Streaming vs loaded-from-history behavior

- While actively streaming: selected custom model routes through `resolveModel()` and the provider URL/API key captured at resolution time.
- After reload / history reconstruction: `createMastraCode()` reloads settings, repopulates custom catalog entries, and prefilled sessions can point at custom model IDs.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Custom providers | `settings.json` `customProviders` | `/custom-providers`, model resolver before gateway/built-ins, catalog provider |
| Provider slug/id | `getCustomProviderId(name)` | model IDs, duplicate checks, resolver lookup |
| Provider model IDs | `toCustomProviderModelId(providerName, modelName)` | `/models`, `/om`, Harness model list |
| Provider auth | optional provider `apiKey` in settings | `ModelRouterLanguageModel`, auth checker/model selector |
| Harness request headers | `resolveModel()` derives `x-thread-id`/`x-resource-id` from requestContext | Custom provider `ModelRouterLanguageModel` requests |
| Custom model catalog | Harness `customModelCatalogProvider` | `listAvailableModels()`, model selector, OM selector |

## Key files

- `mastracode/src/tui/commands/custom-providers.ts` — CRUD/modal flow and pure settings mutation helpers.
- `mastracode/src/tui/command-dispatch.ts` — `/custom-providers` routing and analytics tracking.
- `mastracode/src/tui/setup.ts`, `components/help-overlay.ts` — autocomplete/help list registration.
- `mastracode/src/onboarding/settings.ts` — `CustomProviderSetting`, parsing/sanitization, provider slug/model ID helpers, settings persistence.
- `mastracode/src/agents/model.ts` — custom provider resolution through `ModelRouterLanguageModel` before gateway/built-in paths, including Harness thread/resource headers.
- `mastracode/src/index.ts` — `modelAuthChecker` and `customModelCatalogProvider` wiring.
- `packages/core/src/harness/harness.ts`, `types.ts` — custom model catalog merge into `listAvailableModels()`.

## Dependencies / related features

- [Model auth, selection, and modes](./model-auth-and-modes.md) — custom provider models join the same model selector and model routing path.
- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — providers persist in the global settings file.
- [Thinking and reasoning effort](./thinking-and-reasoning.md) — custom OpenAI-compatible providers do not automatically inherit provider-specific reasoning middleware.
- [Help and shortcuts](../tui/help-and-shortcuts.md) — command is listed in `/help`.

## Existing tests

- `mastracode/src/tui/commands/__tests__/custom-providers.test.ts` — upsert/rename/add/remove model/provider settings helpers.
- `mastracode/src/onboarding/__tests__/settings.test.ts` — custom provider parsing/sanitization, slug creation, optional API-key persistence, provider-prefix stripping.
- `mastracode/src/agents/__tests__/model.test.ts` — custom provider routing and harness header forwarding.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — `/custom-providers` dispatch and analytics tracking.
- `mastracode/src/tui/commands/__tests__/models-pack.test.ts` — custom provider model availability interactions through model pack flows.
- `packages/core/src/harness/list-available-models.test.ts` — Harness custom model catalog merge, custom-over-built-in duplicate precedence, use-count merge, and cache invalidation after provider edits.
- `mastracode/scripts/mc-e2e/scenarios/custom-provider-management.ts` — TUI e2e coverage for a configured provider appearing in `/custom-providers`, provider management selection, add-model modal entry, and reopened persisted model count.
- `mastracode/scripts/mc-e2e/scenarios/custom-provider-delete.ts` — TUI e2e coverage for deleting a configured provider through the destructive confirmation modal and proving persisted removal while unrelated custom packs remain.
- `mastracode/scripts/mc-e2e/scenarios/custom-provider-edit-share-import.ts` — TUI e2e coverage for editing a provider name/URL/API key through default-valued modals and proving persisted settings update.
- `mastracode/scripts/mc-e2e/scenarios/custom-provider-model-selector.ts` — TUI e2e coverage for `/models` creating a custom pack by selecting configured custom-provider catalog entries, rejecting free-form `Use:` fallback, and proving active defaults plus saved pack models persist.
- `mastracode/scripts/mc-e2e/scenarios/custom-provider-modal-validation.ts` — TUI e2e coverage for provider creation, duplicate-name rejection, invalid URL rejection, and remove-model persistence through real modal input.
- `mastracode/scripts/mc-e2e/scenarios/om-model-override-reload.ts` — TUI e2e coverage for `/om` restoring and persisting custom-provider observer/reflector model overrides across startup/global/thread settings.

## Missing tests

- Covered: provider creation, duplicate-name rejection, invalid URL rejection, and remove-model persistence via `custom-provider-modal-validation`; add-model persistence via `custom-provider-management`; edit persistence via `custom-provider-edit-share-import`; provider deletion persistence via `custom-provider-delete`.
- Covered: Harness `listAvailableModels()` custom catalog merge, cache invalidation, use-count merge, and duplicate model IDs (`packages/core/src/harness/list-available-models.test.ts`).
- Covered: `/models` custom-provider catalog selection/persistence via `custom-provider-model-selector`.
- Covered: `/om` selector custom-provider observer/reflector persistence across restart via `om-model-override-reload`.

## Known risks / regressions

- Custom provider auth is stored in settings, unlike OAuth/API-key auth storage, so settings-file handling must avoid accidental exposure.
- Provider IDs are derived from display names; rename changes model ID prefixes and can orphan existing thread/model-pack references.
- Custom providers intentionally win over built-in/gateway routing for matching provider slugs, so collisions are powerful and need clear UI copy.
- Catalog entries are cached by Harness; provider edits need cache invalidation or fresh Harness construction to appear immediately.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
