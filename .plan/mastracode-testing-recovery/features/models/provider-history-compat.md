# Provider history compatibility

## Origin PR / commit

- PR: [#15730](https://github.com/mastra-ai/mastra/pull/15730) — adds the extensible `ProviderHistoryCompat` processor and wires it into Mastra Code.
- Later changes: [#16176](https://github.com/mastra-ai/mastra/pull/16176) — adds the core provider-boundary `processLLMRequest` hook and extends `ProviderHistoryCompat` with prompt-only reasoning rewrites for Cerebras and Anthropic.

## User-visible behavior

- What the user can do: continue conversations when prior provider history contains tool IDs or reasoning parts another provider rejects.
- Success looks like: Mastra Code automatically sanitizes incompatible history, retries eligible API rejections once, and strips provider-incompatible reasoning only from outbound prompts.
- Must preserve: persisted reasoning traces for providers that can keep them, sanitized tool-call/tool-result ID consistency, and no retry loop after the first compatibility fix attempt.

## Entry points / commands

- Commands / shortcuts / flags: no direct command.
- Automatic triggers: core `processLLMRequest` prompt processors after `MessageList → LanguageModelV2Prompt` conversion and immediately before provider calls; `processAPIError` processors after provider API rejections.

## TUI states

- Idle: no visible state.
- Active / modal / error: compatibility fixes run during the active model request; failures should surface like normal provider errors if no rule matches.

## Headless / non-TUI behavior

- Supported: shared agent processors apply in Mastra Code TUI and headless/runtime flows that configure `ProviderHistoryCompat`.
- Not supported / unknown: no user-visible diagnostics listing which compat rule fired.

## Streaming / loading / interrupted states

- Streaming / loading: outbound prompt rewrites happen before streaming begins; reactive API-error fixes request a retry before final failure.
- Abort / retry / resume: processor guards `retryCount > 0` so the same API error does not retry indefinitely.

## Streaming vs loaded-from-history behavior

- While actively streaming: Cerebras/Anthropic reasoning stripping is outbound-only and does not mutate persisted history.
- After reload / history reconstruction: reactive Anthropic tool-ID sanitization mutates stored message history so subsequent runs use valid IDs.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Compat rules | `DEFAULT_COMPAT_RULES` plus constructor `additionalRules` | `ProviderHistoryCompat.processLLMRequest()` and `processAPIError()` |
| Provider-boundary prompt hook | Core `ProcessorRunner.runProcessLLMRequest()` over resolved LLM request input processors | Agentic loop immediately before `doStream`/`doGenerate`, prompt cache/rewrite processors |
| Tool-call ID map | Core message list db records mutated by `rewriteToolIds()` after matched Anthropic API errors | Provider retry, future history loads |
| Reasoning stripping | Immutable prompt copy produced by `stripReasoningFromPrompt()` for provider-scoped rules | Outbound Cerebras/Anthropic requests only |

## Key files

- `packages/core/src/processors/provider-history-compat.ts` — rule registry, provider matching, Anthropic tool-ID sanitization, Cerebras reasoning stripping, Anthropic foreign-reasoning stripping, and retry guard.
- `packages/core/src/processors/runner.ts` — `runProcessLLMRequest()` provider-boundary hook, transient prompt mutation, first-cache-hit response short-circuit, and shared per-request processor state.
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts` — converts `MessageList` to `LanguageModelV2Prompt`, runs `processLLMRequest`, then forwards the rewritten prompt or cached response to the model.
- `packages/core/src/processors/provider-history-compat.test.ts` — rule, mutation, provider matching, prompt rewrite, and processor-runner coverage.
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.test.ts` — verifies `processLLMRequest` rewrites outbound prompts without persisting them.
- `mastracode/src/index.ts` — wires `ProviderHistoryCompat` into both input and error processors for the main code agent.
- `mastracode/src/__tests__/index.test.ts` — verifies Mastra Code processor wiring.

## Dependencies / related features

- [Model auth, selection, and modes](./model-auth-and-modes.md) — selected provider/model determines which compatibility rules apply.
- [Prompt context and project instructions](../chat/prompt-context.md) — prompt processors can modify outbound model history without changing user-facing instructions.
- [OpenAI strict schema compatibility](./openai-strict-schema-compat.md) — another provider-boundary compatibility layer.

## Existing tests

- `packages/core/src/processors/provider-history-compat.test.ts` — invalid Anthropic tool IDs, response-body matching, retryCount guard, no-op valid IDs, Cerebras detection, Anthropic detection, foreign/native reasoning handling, immutable prompt rewrites, and `ProcessorRunner.runProcessLLMRequest()`.
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.test.ts` — `processLLMRequest` runs before the provider, forwards `retryCount`, keeps prompt changes transient, and can combine request-specific and direct input processor lists.
- `mastracode/src/__tests__/index.test.ts` — asserts the code agent includes `provider-history-compat` in both input and error processors.

## Missing tests

- End-to-end provider smoke with a real rejected history shape proving user-visible recovery, not only mocked error strings.
- Regression for additional/custom compat rules supplied by constructor in a downstream app.
- TUI/headless trace/log assertion identifying when a compatibility rule fired.

## Known risks / regressions

- Provider error text can drift; reactive rules depend on regex/error-body matching.
- Reactive tool-ID sanitization mutates history, so ID rewrites must keep tool-call and tool-result IDs consistent across all stored message shapes.
- Preemptive reasoning stripping must stay provider-scoped; some providers require reasoning history to round-trip.
- `processLLMRequest` is a provider-boundary hook, not persisted history mutation; downstream processors that expect durable changes must use message-list phases instead.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
