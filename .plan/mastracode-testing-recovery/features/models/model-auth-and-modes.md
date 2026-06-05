# Model authentication, selection, and modes

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — OAuth/API-key providers, model selection, and Build/Plan/Fast modes.
- Later changes: [#13231](https://github.com/mastra-ai/mastra/pull/13231) — runtime model selection from request context and gateway heartbeat sync; [#13245](https://github.com/mastra-ai/mastra/pull/13245) — moved mode/model runtime ownership onto core Harness sessions; [#13307](https://github.com/mastra-ai/mastra/pull/13307) — reloads AuthStorage before model resolution to avoid stale OpenAI Codex credentials; [#13421](https://github.com/mastra-ai/mastra/pull/13421) — added onboarding/global settings and model packs; [#13431](https://github.com/mastra-ai/mastra/pull/13431) — temporarily changed Codex defaults, but current source now uses OpenAI `gpt-5.5` pack/login defaults; [#13500](https://github.com/mastra-ai/mastra/pull/13500) — onboarding accepts API-key-only access without OAuth; [#13505](https://github.com/mastra-ai/mastra/pull/13505) / [#13508](https://github.com/mastra-ai/mastra/pull/13508) — added and strengthened Claude Max OAuth warning, later removed by #14605 in current source; [#13490](https://github.com/mastra-ai/mastra/pull/13490) — wired `/think`/thinking state into OpenAI Codex reasoning effort; [#13512](https://github.com/mastra-ai/mastra/pull/13512) — unified `/models` around the pack selector and improved custom pack edit/import/delete behavior; [#13566](https://github.com/mastra-ai/mastra/pull/13566) — checks the full provider registry for API-key access instead of only hardcoded providers; [#13600](https://github.com/mastra-ai/mastra/pull/13600) — makes Anthropic API keys a fallback when Claude Max OAuth is not configured; [#13682](https://github.com/mastra-ai/mastra/pull/13682) — adds user-defined OpenAI-compatible providers to model routing and model catalogs; [#13716](https://github.com/mastra-ai/mastra/pull/13716) — exports `resolveModel` from `createMastraCode()` for external consumers; [#13611](https://github.com/mastra-ai/mastra/pull/13611) — fixes explicit `mastra/` gateway routing, OAuth direct-provider bypass, and shared auth-storage initialization across Anthropic/OpenAI/GitHub Copilot providers; [#13695](https://github.com/mastra-ai/mastra/pull/13695) — keeps OpenAI structured-output/schema compatibility active when agent-network models have no concrete `modelId`; [#13573](https://github.com/mastra-ai/mastra/pull/13573) — prompts for missing provider API keys during model selection and stores them in AuthStorage for later startup/env loading; [#14433](https://github.com/mastra-ai/mastra/pull/14433) — forwards Harness thread/resource headers through model resolution and core model execution so Memory Gateway/server-side enrichment can see conversation identity; [#14469](https://github.com/mastra-ai/mastra/pull/14469) — temporarily stopped passing custom headers into Claude Max/Codex provider constructors because those APIs rejected them. Current source later evolved in #14952 and reintroduced provider/header plumbing for gateway routing; [#14604](https://github.com/mastra-ai/mastra/pull/14604) — updates OpenAI built-in mode/OM pack defaults (current source: build/plan `openai/gpt-5.5`, fast/OM `openai/gpt-5.4-mini`); [#14605](https://github.com/mastra-ai/mastra/pull/14605) — removes the Claude Max OAuth warning/acknowledgement flow from login and onboarding; [#14867](https://github.com/mastra-ai/mastra/pull/14867) — fixes gateway provider type generation for digit-leading provider names such as `302ai`; current source owns the quoting in core `registry-generator.ts` after later gateway-sync consolidation; [#14952](https://github.com/mastra-ai/mastra/pull/14952) — adds the Mastra Gateway model-router provider path, Memory Gateway API-key/base-URL settings, and server memory proxy integration for `mastra/` agents; [#14936](https://github.com/mastra-ai/mastra/pull/14936) — masks API-key and login input fields in TUI dialogs.

## User-visible behavior

- What the user can do: authenticate providers, configure Memory Gateway credentials/base URL, choose model packs, create/edit/share/import custom packs, enter missing provider API keys from model-selection flows, switch modes, run headless with model/mode flags, and let external `createMastraCode()` consumers resolve the same configured models.
- Success looks like: footer, prompt/runtime model, `/models` selected pack, provider API-key availability, explicit `mastra/` gateway routing, generated gateway provider cache/types, Anthropic/OpenAI OAuth/API-key priority, Memory Gateway server proxy behavior, stored API-key env loading, harness `x-thread-id`/`x-resource-id` forwarding, current OpenAI defaults, and persisted thread/session state agree.
- Must preserve: selected model/mode across thread switch and restart, targeted custom pack edits, model use-count ranking, env-var precedence over stored keys, no removed Claude Max warning gate, masked sensitive-key prompts, safe fallback to defaults, and valid generated TypeScript for provider IDs that are not plain identifiers.

## Entry points / commands

- Commands / shortcuts / flags: `/login`, `/models`, `/memory-gateway`, `/setup`, `/mode`, `/think`, Shift+Tab, `--model`, `--mode`, `--thinking-level`.
- Automatic triggers: startup provider access checks, stored API-key env loading, model-selection missing-key prompts, settings/model-pack defaults, thread/session metadata sync.

## TUI states

- Idle: footer/status shows current mode/model and auth availability; `/models` opens the single model-pack selector path.
- Active / modal / error: model selection prompts for missing keys in a masked dialog with provider/env-var copy; custom packs use action/edit/import/share overlays; mode switching is blocked during active runs/plan approval.

## Headless / non-TUI behavior

- Supported: `--model` overrides; `--mode` selects Build/Plan/Fast; same AuthStorage/settings path.
- Not supported / unknown: interactive auth prompts are TUI-oriented; headless should fail clearly if auth is unavailable.

## Streaming / loading / interrupted states

- Streaming / loading: active run should keep the model selected when the run started.
- Abort / retry / resume: model/mode changes are between-run state, not streamed message history.

## Streaming vs loaded-from-history behavior

- While actively streaming: harness session model/mode drives runtime and footer projection.
- After reload / history reconstruction: `createMastraCode()` seeds sessions from thread metadata/session records or mode defaults.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Current model ID | Harness session + persisted thread/session metadata | Runtime, footer, prompt context |
| Current mode ID | Harness session | Runtime, footer, prompt mode section |
| Provider credentials | Shared AuthStorage/settings/env + provider registry `apiKeyEnvVar`, initialized for Anthropic/OpenAI/GitHub Copilot, stored under `apikey:<provider>`, loaded into env without overriding real env vars, and reloaded by `resolveModel()` | Model resolver, exported `createMastraCode().resolveModel`, model-selection API-key prompts, onboarding access gate, pack filtering |
| Gateway routing/cache types | `resolveModel()` explicit `mastra/<provider>/<model>` branch + `MASTRA_GATEWAY_API_KEY` / stored gateway key (`mastra-gateway`) + `settings.memoryGateway.baseUrl` + Harness request headers from `RequestContext`; core `generateTypesContent()` quotes non-identifier provider keys including digit-leading IDs | Memory Gateway model router, direct OAuth provider wrappers, server-side memory enrichment, generated provider cache/types |
| Custom providers | `settings.json` `customProviders` + Harness custom catalog + Harness request headers | Model resolver, model selector, `/models`, `/om` |
| Anthropic auth priority | `resolveModel()` (`oauth` credential → stored/env API key → OAuth prompt fallback) | Anthropic provider construction, docs/auth guidance |
| Model packs | Settings + thread active pack metadata + provider-filtered built-in pack definitions (`openai/gpt-5.5` build/plan, `openai/gpt-5.4-mini` fast/OM in current source) | `/setup`, `/models`, session defaults |
| Custom pack CRUD/import/share | `settings.json` custom packs + clipboard payloads | `/models` custom action flow, startup defaults |
| Model use counts | `settings.json` `modelUseCounts`, updated by Harness `switchModel()` | Model selector ranking |
| Thinking level | Harness/settings | Model provider options, prompt context, `/think` |
| OpenAI schema compatibility | Core agent + `@mastra/schema-compat` | Structured output, agent-network completion checks, workspace/tool schemas |
| Per-call model headers | Core LLM execution step merges memory headers (`x-thread-id`, `x-resource-id`) → model config headers → `modelSettings.headers` overrides | Model provider requests, Memory Gateway, provider-specific routing |

## Key files

- `mastracode/src/index.ts` — provider checks, registry API-key env scan, mode defaults, session prefill, and exported `resolveModel` in `createMastraCode()` result.
- `mastracode/src/agents/model.ts` — provider/model resolution, custom provider routing, explicit gateway routing, Anthropic/OpenAI API-key fallback, OAuth priority, and Harness thread/resource header extraction from `RequestContext`.
- `mastracode/src/providers/claude-max.ts`, `openai-codex.ts`, `github-copilot.ts` — provider-specific OAuth fetch/storage integration and current provider-header handling used by the shared auth path.
- `mastracode/src/auth/storage.ts` — credential persistence, stored provider API-key helpers, env loading, and refresh.
- `mastracode/src/tui/prompt-api-key.ts`, `components/api-key-dialog.ts`, `components/masked-input.ts` — missing-key prompt and masked key entry dialog used by model selectors.
- `mastracode/src/tui/commands/memory-gateway.ts` — Memory Gateway API-key/base-URL configuration command and gateway registry refresh.
- `mastracode/src/onboarding/packs.ts` — provider-filtered built-in model/OM packs and current OpenAI default IDs.
- `mastracode/src/onboarding/settings.ts` — global settings, model-pack resolution, legacy pack migrations, and removed Claude Max warning field absence.
- `mastracode/src/tui/commands/models-pack.ts` — unified `/models` pack selector, missing-key prompt trigger, custom pack edit/delete/share/import flow, and OpenAI pack thinking auto-enable.
- `mastracode/src/tui/components/model-selector.ts` — model search/sort list with current/auth/use-count ordering.
- `mastracode/src/tui/commands/mode.ts` — `/mode`.
- `mastracode/src/headless.ts` — model/mode flags.
- `packages/core/src/agent/agent.ts` and `packages/schema-compat/src/provider-compats/openai*.ts` — OpenAI structured-output/schema compatibility used after model routing.
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts` — per-run model header merge order and automatic `x-thread-id`/`x-resource-id` model request headers.
- `packages/core/src/llm/model/registry-generator.ts` and `mastracode/src/utils/gateway-sync.ts` — current gateway provider sync/type generation path; MastraCode delegates to core `GatewayRegistry`, which quotes invalid provider identifiers when generating types.
- `packages/server/src/server/handlers/gateway-memory-client.ts`, `memory.ts`, and `agents.ts` — server-side Memory Gateway client/proxy behavior and provider listing for gateway-backed agents.

## Dependencies / related features

- [Persistent conversations](../threads/persistent-conversations.md) — reload preservation uses thread/session metadata.
- [Interactive TUI chat](../tui/interactive-chat.md) — active chat runs through selected model/mode.
- [Thinking and reasoning effort](./thinking-and-reasoning.md) — model selection determines whether `/think` affects provider options.
- [Custom OpenAI-compatible providers](./custom-providers.md) — custom provider models are model-selector/model-router entries.
- [OpenAI strict schema compatibility](./openai-strict-schema-compat.md) — provider/model detection controls strict-schema handling.

## Existing tests

- `mastracode/src/agents/__tests__/model.test.ts` — provider/model resolution, custom provider routing, Anthropic/OpenAI API-key fallback, stored key resolution, OAuth priority, explicit `mastra/` gateway routing, gateway base URL/key selection, harness header forwarding, provider-header current behavior, and generic `authStorage.reload()` assertion.
- `mastracode/src/__tests__/index.test.ts` — startup auth-storage/env loading and provider access plumbing with mocked providers.
- `mastracode/src/__tests__/codex-model-routing.test.ts` — Codex routing.
- `mastracode/src/onboarding/__tests__/packs.test.ts`, `settings.test.ts` — built-in pack defaults (including current OpenAI defaults), settings resolution, and stale-field migrations.
- `mastracode/src/tui/commands/__tests__/models-pack.test.ts` — custom pack upsert/remove/rename/edit/share/import helpers and serialization.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — verifies `/models:pack` is no longer routed as a valid command.
- `mastracode/src/tui/commands/__tests__/mode.test.ts` — mode switching.
- `mastracode/src/HarnessCompat.test.ts`, `headless.test.ts` — session/headless coverage.
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.test.ts` — model config headers, `modelSettings.headers` overrides, and automatic memory header forwarding into execution requests.
- `packages/core/src/llm/model/registry-generator.test.ts` and `mastracode/src/utils/__tests__/gateway-sync.test.ts` — generated provider-key quoting, including digit-leading provider IDs, and the MastraCode gateway-sync wrapper delegation.
- `mastracode/src/tui/commands/__tests__/memory-gateway.test.ts` — `/memory-gateway` API-key/base-URL persistence, custom URL flow, env update, and gateway sync refresh.
- `packages/core/src/agent/__tests__/memory-gateway-duck-typing.test.ts` — gateway model duck-typing regression for model-router memory integration.

## Missing tests

- Select model pack → restart TUI → footer/runtime/prompt model agree.
- Thread switch preserves per-thread model without overwriting defaults.
- Full TUI overlay journey for custom pack action picker, targeted edit, import collision, share, delete, and activation.
- Headless `--model` precedence over `--mode` after Harness v1 migration.
- OpenAI Codex-specific stale credential regression test after login/auth file update.
- Startup/onboarding regression for a non-hardcoded registry provider API key (for example Groq/Mistral) enabling provider access and custom model selection.
- Full TUI model-selection regression for unavailable provider → masked API-key dialog → stored key saved → selector/model state refresh, including cancel/empty-key paths.
- End-to-end Anthropic API-key fallback through real `createAnthropic()`/network-disabled provider construction, not only mocked model resolver tests.
- Integration test that `createAuthStorage()` initializes every provider-specific auth module used by model resolution and catalog refresh.
- Mastra Code runtime regression for OpenAI structured-output/tool schema compatibility through the selected model path.
- Network-disabled regression that Claude Max/Codex OAuth requests either preserve or strip Harness headers according to the active provider/gateway path; #14469 and later #14952 changed this contract.
- Direct server route tests for Memory Gateway proxy behavior (`GET_MEMORY_STATUS_ROUTE`, OM history/status polling, thread/message listing) are still sparse compared with the mocked Mastra Code model/command tests.

## Known risks / regressions

- Slack reported “No model selected” after reload using model packs.
- PR #17411 / #17546 history suggests session-state composition was risky here.
- Env leakage caused model tests to fail in audits; isolate env before blaming product code.
- Provider registry `apiKeyEnvVar` can be string or array; startup/setup/model-picker access can drift if one path only handles one shape.
- Env vars intentionally take priority over stored `apikey:<provider>` credentials; prompts/storage must avoid overwriting a user's shell environment unexpectedly.
- Anthropic has three runtime outcomes (OAuth, API key, OAuth prompt fallback); auth-copy, onboarding state, and `resolveModel()` priority must stay synchronized. The old Claude Max warning acknowledgement is intentionally gone in current source.
- Built-in OpenAI/Codex defaults drift; #14604/current source assert `gpt-5.5` build/plan and `gpt-5.4-mini` fast/OM even though #13431 temporarily changed defaults to `gpt-5.2`.
- Plain provider IDs and explicit `mastra/` IDs intentionally route differently; prompt/model-pack code must avoid accidentally adding or stripping the prefix.
- Gateway provider names come from remote registry data; generated type/cache code must quote any key that is not a valid JavaScript identifier, including digit-leading names, or the cache can be repeatedly deleted as corrupt.
- Harness header forwarding is easy to regress because headers are merged both in Mastra Code model construction and in core LLM execution; provider APIs may reject unexpected custom headers.
- Pack identity can be global, thread-scoped, inferred from per-mode IDs, or removed during custom pack cleanup; stale IDs are a reload risk.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
