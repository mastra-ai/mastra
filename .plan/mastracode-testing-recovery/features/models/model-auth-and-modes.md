# Model authentication, selection, and modes

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — OAuth/API-key providers, model selection, and Build/Plan/Fast modes.
- Later changes: [#13231](https://github.com/mastra-ai/mastra/pull/13231) — runtime model selection from request context and gateway heartbeat sync; [#13245](https://github.com/mastra-ai/mastra/pull/13245) — moved mode/model runtime ownership onto core Harness sessions; [#13307](https://github.com/mastra-ai/mastra/pull/13307) — reloads AuthStorage before model resolution to avoid stale OpenAI Codex credentials; [#13421](https://github.com/mastra-ai/mastra/pull/13421) — added onboarding/global settings and model packs; [#13431](https://github.com/mastra-ai/mastra/pull/13431) — temporarily changed Codex defaults, but current source now uses OpenAI `gpt-5.5` pack/login defaults; [#13500](https://github.com/mastra-ai/mastra/pull/13500) — onboarding accepts API-key-only access without OAuth; [#13505](https://github.com/mastra-ai/mastra/pull/13505) / [#13508](https://github.com/mastra-ai/mastra/pull/13508) — added and strengthened Claude Max OAuth warning, later removed by #14605 in current source; [#13490](https://github.com/mastra-ai/mastra/pull/13490) — wired `/think`/thinking state into OpenAI Codex reasoning effort; [#13512](https://github.com/mastra-ai/mastra/pull/13512) — unified `/models` around the pack selector and improved custom pack edit/import/delete behavior; [#13566](https://github.com/mastra-ai/mastra/pull/13566) — checks the full provider registry for API-key access instead of only hardcoded providers; [#13600](https://github.com/mastra-ai/mastra/pull/13600) — makes Anthropic API keys a fallback when Claude Max OAuth is not configured; [#13682](https://github.com/mastra-ai/mastra/pull/13682) — adds user-defined OpenAI-compatible providers to model routing and model catalogs; [#13716](https://github.com/mastra-ai/mastra/pull/13716) — exports `resolveModel` from `createMastraCode()` for external consumers; [#13611](https://github.com/mastra-ai/mastra/pull/13611) — fixes explicit `mastra/` gateway routing, OAuth direct-provider bypass, and shared auth-storage initialization across Anthropic/OpenAI/GitHub Copilot providers; [#13695](https://github.com/mastra-ai/mastra/pull/13695) — keeps OpenAI structured-output/schema compatibility active when agent-network models have no concrete `modelId`; [#13573](https://github.com/mastra-ai/mastra/pull/13573) — prompts for missing provider API keys during model selection and stores them in AuthStorage for later startup/env loading; [#14433](https://github.com/mastra-ai/mastra/pull/14433) — forwards Harness thread/resource headers through model resolution and core model execution so Memory Gateway/server-side enrichment can see conversation identity; [#14469](https://github.com/mastra-ai/mastra/pull/14469) — temporarily stopped passing custom headers into Claude Max/Codex provider constructors because those APIs rejected them. Current source later evolved in #14952 and reintroduced provider/header plumbing for gateway routing; [#14604](https://github.com/mastra-ai/mastra/pull/14604) — updates OpenAI built-in mode/OM pack defaults (current source: build/plan `openai/gpt-5.5`, fast/OM `openai/gpt-5.4-mini`); [#14605](https://github.com/mastra-ai/mastra/pull/14605) — removes the Claude Max OAuth warning/acknowledgement flow from login and onboarding; [#14867](https://github.com/mastra-ai/mastra/pull/14867) — fixes gateway provider type generation for digit-leading provider names such as `302ai`; current source owns the quoting in core `registry-generator.ts` after later gateway-sync consolidation; [#14952](https://github.com/mastra-ai/mastra/pull/14952) — adds the Mastra Gateway model-router provider path, Memory Gateway API-key/base-URL settings, and server memory proxy integration for `mastra/` agents; [#14936](https://github.com/mastra-ai/mastra/pull/14936) — masks API-key and login input fields in TUI dialogs; [#15014](https://github.com/mastra-ai/mastra/pull/15014) — adds `/api-keys` for viewing provider credential status, adding stored keys, and deleting stored keys; [#15370](https://github.com/mastra-ai/mastra/pull/15370) — adds custom model-pack share/import via `mastra-pack:` payloads and clipboard fallback; [#14909](https://github.com/mastra-ai/mastra/pull/14909) — adds headless `--model` override/preflight on top of shared settings/AuthStorage; [#15458](https://github.com/mastra-ai/mastra/pull/15458) — bumps Anthropic built-in pack defaults to OAuth `claude-opus-4-7` and API-key `claude-sonnet-4-6`; [#15483](https://github.com/mastra-ai/mastra/pull/15483) — makes Anthropic/OpenAI API-key resolution fall back through the provider stored-key slot before env vars; [#15631](https://github.com/mastra-ai/mastra/pull/15631) — normalizes long Fireworks model IDs and generic `p` version separators before TUI status-line compact/full rendering; [#15703](https://github.com/mastra-ai/mastra/pull/15703) — lets `/om` observer/reflector pickers accept arbitrary custom model strings while preserving the other role's current model when leaving a built-in OM pack; [#15759](https://github.com/mastra-ai/mastra/pull/15759) — updates the OpenAI built-in pack/default prompts to `openai/gpt-5.5` build/plan and `openai/gpt-5.4-mini` fast/OM; [#16294](https://github.com/mastra-ai/mastra/pull/16294) — fixes OpenAI Codex OAuth callback port selection by trying 1455, then 1457, then warning without scanning arbitrary ports; [#16332](https://github.com/mastra-ai/mastra/pull/16332) — consolidates Mastra Code gateway sync behind core `GatewayRegistry` and silently deletes corrupt provider cache/type files before falling back to bundled data; [#16129](https://github.com/mastra-ai/mastra/pull/16129) — adds GitHub Copilot OAuth/device login, Copilot-backed model routing, a provider-filtered Copilot pack, and live `/models` catalog discovery; [#16548](https://github.com/mastra-ai/mastra/pull/16548) — adds selectable OpenAI Codex browser/device login, official Codex device flow, ChatGPT account-id storage/refresh, Codex runtime headers, and MCP OAuth config documentation; [#16922](https://github.com/mastra-ai/mastra/pull/16922) — generates per-provider attachment capability files and exposes `modelSupportsAttachments()` for model-aware attachment decisions; [#16984](https://github.com/mastra-ai/mastra/pull/16984) — suppresses gateway refresh/fetch failures and falls back quietly to bundled registry data.

## User-visible behavior

- What the user can do: authenticate providers, choose OpenAI Codex browser or device-code login, inspect/add/delete provider API keys with `/api-keys`, configure Memory Gateway credentials/base URL, choose model packs with current Anthropic/OpenAI/GitHub Copilot defaults, create/edit/share/import custom packs, enter missing provider API keys from model-selection flows, enter custom `/om` observer/reflector model strings, switch modes, run headless with model/mode flags, and let external `createMastraCode()` consumers resolve the same configured models.
- Success looks like: footer, prompt/runtime model, `/models` selected pack, provider API-key availability, explicit `mastra/` gateway routing, GitHub Copilot OAuth + live model catalog, generated gateway provider cache/types, Anthropic/OpenAI OAuth/API-key priority, OpenAI Codex browser callback port fallback/device login/account-id headers, Memory Gateway server proxy behavior, stored API-key env loading, harness `x-thread-id`/`x-resource-id` forwarding, current OpenAI GPT-5.5 defaults, normalized compact status-line model IDs, persisted thread/session state agree, corrupt global provider cache files are removed without noisy startup warnings, and failed gateway refreshes quietly fall back to bundled data.
- Must preserve: selected model/mode across thread switch and restart, targeted custom pack edits, OM observer/reflector overrides when switching one role to a custom model, model use-count ranking, env-var precedence over stored keys, no removed Claude Max warning gate, masked sensitive-key prompts, explicit auth-mode selection before starting multi-flow OAuth providers, safe fallback to defaults, and valid generated TypeScript for provider IDs that are not plain identifiers.

## Entry points / commands

- Commands / shortcuts / flags: `/login`, `/api-keys`, `/models`, `/memory-gateway`, `/setup`, `/mode`, `/think`, Shift+Tab, `--model`, `--mode`, `--thinking-level`.
- Automatic triggers: startup provider access checks, stored API-key env loading, model-selection missing-key prompts, settings/model-pack defaults, thread/session metadata sync.

## TUI states

- Idle: footer/status shows current mode/model and auth availability; long Fireworks paths render as compact `fireworks/<model>` labels and model versions such as `kimi-k2p6` / `minimax-m2p7` render as `kimi-k2.6` / `minimax-m2.7`; `/models` opens the single model-pack selector path.
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
| Current model ID | Harness session + persisted thread/session metadata + headless `--model` override after preflight | Runtime, footer, prompt context, headless execution |
| Current mode ID | Harness session + headless `--mode` fallback when `--model` is absent | Runtime, footer, prompt mode section |
| Provider credentials | Shared AuthStorage/settings/env + provider registry `apiKeyEnvVar`, initialized for Anthropic/OpenAI/GitHub Copilot/OpenAI Codex, stored under `apikey:<provider>`, loaded into env without overriding real env vars, and reloaded by `resolveModel()`; Anthropic/OpenAI key helpers check main credential slot → provider stored-key slot → env var; GitHub Copilot stores long-lived GitHub OAuth in `refresh`, short-lived Copilot bearer in `access`, expiry, and optional enterprise domain; OpenAI Codex stores access/refresh/expiry plus ChatGPT `accountId` extracted from token claims | Model resolver, `/api-keys`, `/login`, exported `createMastraCode().resolveModel`, model-selection API-key prompts, onboarding access gate, pack filtering |
| Gateway routing/cache types | `resolveModel()` explicit `mastra/<provider>/<model>` branch + `MASTRA_GATEWAY_API_KEY` / stored gateway key (`mastra-gateway`) + `settings.memoryGateway.baseUrl` + Harness request headers from `RequestContext`; core `GatewayRegistry` owns sync/cache writes, corrupt-cache deletion, static fallback, `generateTypesContent()` quoting for non-identifier provider keys including digit-leading IDs, and generated attachment capability files | Memory Gateway model router, direct OAuth provider wrappers, server-side memory enrichment, generated provider cache/types/capabilities, OM attachment Auto mode |
| Custom providers | `settings.json` `customProviders` + Harness custom catalog + Harness request headers; GitHub Copilot contributes a dynamic custom catalog from its `/models` endpoint, cached for 10 minutes on success and 1 minute on fallback | Model resolver, model selector, `/models`, `/om` |
| GitHub Copilot model routing | `github-copilot/<model>` IDs in `resolveModel()` + `githubCopilotProvider()` OpenAI-compatible adapter + Copilot OAuth fetch wrapper with proxy-ep URL rewrite, `x-initiator`, vision header, VS Code-like Copilot headers, and live catalog fallback `gpt-4.1` | Runtime model construction, model selector, built-in Copilot pack |
| Anthropic auth priority | `resolveModel()` (`oauth` credential → stored/env API key → OAuth prompt fallback) | Anthropic provider construction, docs/auth guidance |
| Model packs | Settings + thread active pack metadata + provider-filtered built-in pack definitions (`openai/gpt-5.5` build/plan, `openai/gpt-5.4-mini` fast/OM, Anthropic OAuth `claude-opus-4-7`, Anthropic API-key `claude-sonnet-4-6` in current source) | `/setup`, `/models`, session defaults |
| Custom pack CRUD/import/share | `settings.json` custom packs + serialized `mastra-pack:` clipboard payloads | `/models` custom action flow, import validation/collision handling, startup defaults |
| OM custom model overrides | `settings.models.activeOmPackId`, `omModelOverride`, `observerModelOverride`, and `reflectorModelOverride`; `/om` snapshots the other role's current model when leaving a built-in OM pack for `custom`; resolved observer model IDs feed attachment capability lookup | Observer/reflector model functions, OM settings modal, global/thread settings persistence, OM attachment Auto mode |
| Model use counts | `settings.json` `modelUseCounts`, updated by Harness `switchModel()` | Model selector ranking |
| Thinking level | Harness/settings | Model provider options, prompt context, `/think` |
| OpenAI schema compatibility | Core agent + `@mastra/schema-compat` | Structured output, agent-network completion checks, workspace/tool schemas |
| Per-call model headers | Core LLM execution step merges memory headers (`x-thread-id`, `x-resource-id`) → model config headers → `modelSettings.headers` overrides | Model provider requests, Memory Gateway, provider-specific routing |

## Key files

- `mastracode/src/index.ts` — provider checks, registry API-key env scan, mode defaults, session prefill, and exported `resolveModel` in `createMastraCode()` result.
- `mastracode/src/agents/model.ts` — provider/model resolution, custom provider routing, explicit gateway routing, Anthropic/OpenAI API-key fallback, OAuth priority, and Harness thread/resource header extraction from `RequestContext`.
- `mastracode/src/providers/claude-max.ts`, `openai-codex.ts`, `github-copilot.ts`, `auth/providers/openai-codex.ts`, and `auth/providers/github-copilot.ts` — provider-specific OAuth fetch/storage integration, OpenAI Codex browser/device login, callback port fallback, ChatGPT account-id extraction/refresh, Codex runtime headers, GitHub Copilot device login/token refresh/model catalog, Copilot request rewriting, and current provider-header handling used by the shared auth path.
- `mastracode/src/auth/storage.ts` — credential persistence, stored provider API-key helpers, env loading, OAuth refresh, and shared GitHub Copilot/Anthropic/OpenAI storage initialization.
- `mastracode/src/tui/prompt-api-key.ts`, `components/api-key-dialog.ts`, `components/masked-input.ts`, `components/login-mode-selector.ts`, `tui/commands/login.ts`, and `tui/commands/api-keys.ts` — missing-key prompt, masked key entry dialog used by model selectors, OAuth auth-mode selector for multi-flow providers, `/login`, and `/api-keys` stored-key management command.
- `mastracode/src/tui/commands/memory-gateway.ts` — Memory Gateway API-key/base-URL configuration command and gateway registry refresh.
- `mastracode/src/onboarding/packs.ts` — provider-filtered built-in model/OM packs and current OpenAI/Anthropic/GitHub Copilot default IDs, including OpenAI build/plan `openai/gpt-5.5`, fast/OM `openai/gpt-5.4-mini`, and Copilot build `github-copilot/gpt-4.1`, plan `github-copilot/gemini-2.5-pro`, fast `github-copilot/grok-code-fast-1`.
- `mastracode/src/onboarding/settings.ts` — global settings, model-pack resolution, legacy pack migrations, and removed Claude Max warning field absence.
- `mastracode/src/tui/commands/models-pack.ts` — unified `/models` pack selector, missing-key prompt trigger, custom pack edit/delete/share/import flow, `serializePack()` / `deserializePack()` `mastra-pack:` payload helpers, and OpenAI pack thinking auto-enable.
- `mastracode/src/tui/components/model-selector.ts` — model search/sort list with current/auth/use-count ordering and synthetic `Use: <id>` custom model entries.
- `mastracode/src/tui/commands/om.ts` and `components/om-settings.ts` — `/om` observer/reflector model override persistence and custom OM model picker wiring.
- `mastracode/src/tui/commands/mode.ts` — `/mode`.
- `mastracode/src/headless.ts` — model/mode/settings flags, `--model` vs `--mode` precedence, and model availability/API-key preflight.
- `packages/core/src/llm/model/provider-registry.ts`, `provider-registry.json`, `provider-types.generated.ts`, and `capabilities/*.json` — provider/model registry, cache synchronization, generated provider types, and attachment capability lookup for model-aware features.
- `packages/core/src/agent/agent.ts` and `packages/schema-compat/src/provider-compats/openai*.ts` — OpenAI structured-output/schema compatibility used after model routing.
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts` — per-run model header merge order and automatic `x-thread-id`/`x-resource-id` model request headers.
- `packages/core/src/llm/model/provider-registry.ts`, `registry-generator.ts`, and `mastracode/src/utils/gateway-sync.ts` — current gateway provider sync/type generation path; MastraCode delegates to core `GatewayRegistry`, which coalesces sync freshness, atomically writes cache files, silently deletes corrupt global cache artifacts during sync-to-local validation, and quotes invalid provider identifiers when generating types.
- `packages/server/src/server/handlers/gateway-memory-client.ts`, `memory.ts`, and `agents.ts` — server-side Memory Gateway client/proxy behavior and provider listing for gateway-backed agents.

## Dependencies / related features

- [Persistent conversations](../threads/persistent-conversations.md) — reload preservation uses thread/session metadata.
- [Interactive TUI chat](../tui/interactive-chat.md) — active chat runs through selected model/mode.
- [Thinking and reasoning effort](./thinking-and-reasoning.md) — model selection determines whether `/think` affects provider options.
- [Custom OpenAI-compatible providers](./custom-providers.md) — custom provider models are model-selector/model-router entries.
- [OpenAI strict schema compatibility](./openai-strict-schema-compat.md) — provider/model detection controls strict-schema handling.

## Existing tests

- `mastracode/src/agents/__tests__/model.test.ts` — provider/model resolution, custom provider routing, Anthropic/OpenAI API-key fallback, provider stored-key fallback, env fallback, OAuth priority, OpenAI Codex OAuth routing/remapping, explicit `mastra/` gateway routing, gateway base URL/key selection, harness header forwarding, provider-header current behavior, and generic `authStorage.reload()` assertion.
- `mastracode/src/__tests__/index.test.ts` — startup auth-storage/env loading and provider access plumbing with mocked providers, including shared AuthStorage initialization for GitHub Copilot.
- `mastracode/src/auth/providers/__tests__/github-copilot.test.ts`, `providers/__tests__/github-copilot-catalog.test.ts`, and `providers/__tests__/oauth-fetches.test.ts` — GitHub Copilot device flow, enterprise URL parsing, bearer refresh, `/models` filtering/caching/fallback, proxy-ep URL rewriting, Copilot headers, initiator/vision detection, and fetch error URL annotation.
- `mastracode/src/__tests__/codex-model-routing.test.ts` — Codex routing.
- `mastracode/src/onboarding/__tests__/packs.test.ts`, `settings.test.ts` — built-in pack defaults (including current OpenAI, Anthropic, and GitHub Copilot defaults), settings resolution, and stale-field migrations.
- `mastracode/src/tui/commands/__tests__/models-pack.test.ts` — custom pack upsert/remove/rename/edit/share/import helpers plus `serializePack()` / `deserializePack()` round-trip, invalid string, missing-field, and whitespace handling.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — verifies `/models:pack` is no longer routed as a valid command and mocks `/api-keys` command dispatch.
- `mastracode/src/tui/commands/__tests__/mode.test.ts` — mode switching.
- `mastracode/src/tui/components/__tests__/om-settings.test.ts`, `commands/__tests__/om.test.ts`, `components/__tests__/model-selector.test.ts`, `onboarding/__tests__/settings.test.ts`, and custom-provider/model-pack tests — custom model string acceptance, OM role snapshotting, and persistence behavior.
- `mastracode/src/tui/__tests__/status-line.test.ts` — status-line model ID rendering, including Fireworks long-path normalization and generic `p` version-separator normalization in both full and compact widths.
- `mastracode/src/auth/providers/openai-codex.test.ts` — OpenAI Codex OAuth callback port preference/fallback, authorization URL redirect URI, originator/scope, account ID extraction, refresh, device OAuth behavior, advertised browser/device auth modes, env fallback, and explicit auth-mode override precedence.
- `mastracode/src/HarnessCompat.test.ts`, `headless.test.ts`, and `headless-integration.test.ts` — session/headless coverage, including `--model` parsing, preflight, `--mode` override warnings, JSON error output, model-changed events, and Harness v1 prefilled thread title/model preservation.
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.test.ts` — model config headers, `modelSettings.headers` overrides, and automatic memory header forwarding into execution requests.
- `packages/core/src/llm/model/registry-generator.test.ts`, `provider-registry.test.ts`, and `mastracode/src/utils/__tests__/gateway-sync.test.ts` — generated provider-key quoting, corrupt cache validation/deletion, refresh-time skip logic, attachment capability lookup/fallback, and the MastraCode gateway-sync wrapper delegation.
- `mastracode/src/tui/commands/__tests__/memory-gateway.test.ts` — `/memory-gateway` API-key/base-URL persistence, custom URL flow, env update, and gateway sync refresh.
- `packages/core/src/agent/__tests__/memory-gateway-duck-typing.test.ts` — gateway model duck-typing regression for model-router memory integration.

## Missing tests

- Select model pack → restart TUI → footer/runtime/prompt model agree.
- Covered: thread switch preserves a Harness v1 prefilled session's per-session model without overwriting it with the mode default (`mastracode/src/headless-integration.test.ts`).
- Full TUI overlay journey for custom pack action picker, targeted edit, import collision, share, delete, and activation.
- Packaged CLI smoke that exercises `--model`/`--mode` precedence and auth preflight through the built binary rather than Vitest helpers.
- OpenAI Codex-specific stale credential regression test after login/auth file update.
- Startup/onboarding regression for a non-hardcoded registry provider API key (for example Groq/Mistral) enabling provider access and custom model selection.
- Full TUI model-selection regression for unavailable provider → masked API-key dialog → stored key saved → selector/model state refresh, including cancel/empty-key paths.
- Full `/om` TUI journey for typing a custom observer/reflector model, saving settings, restarting, and confirming both OM roles survive.
- Direct `/api-keys` command tests for provider list de-duping, env/stored/none status labels, add/delete flows, settings-menu entrypoint, and env cleanup after stored-key deletion.
- End-to-end Anthropic/OpenAI API-key fallback through real provider construction after OAuth disconnect/main-slot clearing, not only mocked model resolver tests.
- Integration test that `createAuthStorage()` initializes every provider-specific auth module used by model resolution and catalog refresh.
- End-to-end `/login` → GitHub Copilot device flow → `/models` live catalog → model run smoke against a mocked Copilot API; current tests isolate the pieces but do not cover the full TUI journey.
- Mastra Code runtime regression for OpenAI structured-output/tool schema compatibility through the selected model path.
- Network-disabled regression that Claude Max/Codex OAuth requests either preserve or strip Harness headers according to the active provider/gateway path; #14469 and later #14952 changed this contract.
- Direct server route tests for Memory Gateway proxy behavior (`GET_MEMORY_STATUS_ROUTE`, OM history/status polling, thread/message listing) are still sparse compared with the mocked Mastra Code model/command tests.

## Known risks / regressions

- Slack reported “No model selected” after reload using model packs.
- PR #17411 / #17546 history suggests session-state composition was risky here.
- Env leakage caused model tests to fail in audits; `mastracode/src/agents/__tests__/model.test.ts` should clear provider `*_API_KEY` variables in its setup so local shell credentials cannot affect “no API key configured” expectations.
- Provider registry `apiKeyEnvVar` can be string or array; startup/setup/model-picker access can drift if one path only handles one shape.
- Env vars intentionally take priority over stored `apikey:<provider>` credentials; prompts/storage and `/api-keys` must avoid overwriting a user's shell environment unexpectedly.
- Anthropic has three runtime outcomes (OAuth, API key, OAuth prompt fallback); auth-copy, onboarding state, and `resolveModel()` priority must stay synchronized. The old Claude Max warning acknowledgement is intentionally gone in current source.
- OpenAI Codex browser OAuth must keep the selected callback `redirectUri` synchronized between authorization URL and token exchange; if ports 1455/1457 are occupied, manual-code fallback is required.
- Built-in provider defaults and displayed model labels drift; #15759/current source assert OpenAI `gpt-5.5` build/plan and `gpt-5.4-mini` fast/OM, #15458/current source assert Anthropic OAuth `claude-opus-4-7` and API-key `claude-sonnet-4-6`, #16129/current source asserts GitHub Copilot build/plan/fast defaults, and #15631/current source normalizes Fireworks/generic model IDs only for status-line display.
- GitHub Copilot model availability depends on the user's subscription/org policy; the live catalog fallback intentionally only advertises `gpt-4.1`, so selector assumptions about Claude/Gemini/Grok availability can be wrong offline.
- Plain provider IDs and explicit `mastra/` IDs intentionally route differently; prompt/model-pack code must avoid accidentally adding or stripping the prefix.
- Gateway provider names come from remote registry data; generated type/cache code must quote any key that is not a valid JavaScript identifier, including digit-leading names. Corrupt JSON or `.d.ts` cache files are intentionally deleted and ignored so stale global cache data cannot break startup.
- Harness header forwarding is easy to regress because headers are merged both in Mastra Code model construction and in core LLM execution; provider APIs may reject unexpected custom headers.
- Pack identity can be global, thread-scoped, inferred from per-mode IDs, removed during custom pack cleanup, imported from a serialized `mastra-pack:` string, or split into custom `/om` role overrides; stale IDs and unavailable imported/custom model IDs are reload/import risks.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.

## TUI e2e recovery evidence

- Covered by `state-commands` for `/mode` list visibility and by `automated-chat` for OpenAI AIMock model/auth settings driving a real chat request.
- Verification: `state-commands`, full e2e `--jobs 2`, check, lint, and build passed.
