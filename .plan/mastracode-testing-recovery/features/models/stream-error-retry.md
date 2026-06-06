# Stream error retry processor

## Origin PR / commit

- PR: [#15760](https://github.com/mastra-ai/mastra/pull/15760) — adds a core `StreamErrorRetryProcessor` and enables it in Mastra Code.
- Later changes: none known.

## User-visible behavior

- What the user can do: keep a Mastra Code run alive when a provider emits a transient stream error after generation has started.
- Success looks like: retryable OpenAI Responses stream errors and provider errors marked `isRetryable` trigger one automatic retry instead of immediately ending the run.
- Must preserve: no retry loop, no message mutation, custom matcher extensibility, and clear fallback to normal provider errors when the stream error is not transient.

## Entry points / commands

- Commands / shortcuts / flags: no direct command.
- Automatic triggers: agent `errorProcessors` during provider API/stream error handling; Mastra Code wires the processor by default.

## TUI states

- Idle: no visible state.
- Active / modal / error: active streaming requests can retry once before final failure; unretryable errors surface normally.

## Headless / non-TUI behavior

- Supported: shared Mastra Code agent setup means TUI and headless both use the configured error processor.
- Not supported / unknown: no dedicated user-facing event explains that a stream retry happened.

## Streaming / loading / interrupted states

- Streaming / loading: processor inspects errors emitted during/after stream startup, including OpenAI Responses `error` and `response.failed` chunks.
- Abort / retry / resume: `maxRetries` defaults to `1`; retry count guards prevent repeated retries from the same processor.

## Streaming vs loaded-from-history behavior

- While actively streaming: retry handling is request-local and does not mutate persisted messages.
- After reload / history reconstruction: no loaded-history transformation; only future provider errors are affected.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Retry limit | `StreamErrorRetryProcessorOptions.maxRetries` (`1` default) | `processAPIError()` retry decision |
| Retry matchers | `DEFAULT_MATCHERS` plus constructor `matchers` | `isRetryableStreamError()` |
| Mastra Code wiring | `mastracode/src/index.ts` error processor list | TUI/headless code agent runs |

## Key files

- `packages/core/src/processors/stream-error-retry-processor.ts` — retryable stream-error detection, OpenAI Responses matcher, APICallError metadata check, cause-chain walk, and retry guard.
- `packages/core/src/processors/stream-error-retry-processor.test.ts` — processor and matcher coverage.
- `docs/src/content/en/reference/processors/stream-error-retry-processor.mdx` — public reference page and usage guidance.
- `mastracode/src/index.ts` — enables `StreamErrorRetryProcessor` before `PrefillErrorHandler` and `ProviderHistoryCompat` in the code agent error processor list.
- `mastracode/src/__tests__/index.test.ts` — verifies Mastra Code processor wiring.

## Dependencies / related features

- [Provider history compatibility](./provider-history-compat.md) — adjacent provider-boundary error processor, but mutates history for specific compatibility rules.
- [Model auth, selection, and modes](./model-auth-and-modes.md) — selected provider/model determines whether stream errors have known retry shapes.
- [Prompt mode](../headless/prompt-mode.md) — headless uses the same code agent and should benefit from retries.

## Existing tests

- `packages/core/src/processors/stream-error-retry-processor.test.ts` — retry metadata, cause chains, default/custom matchers, OpenAI retryable/non-retryable chunks, explicit retry guidance, and `maxRetries` behavior.
- `mastracode/src/__tests__/index.test.ts` — asserts Mastra Code wires `StreamErrorRetryProcessor` before `PrefillErrorHandler` and `ProviderHistoryCompat`, so transient stream errors get first chance to retry before provider-specific fallback processors run.

## Missing tests

- End-to-end real OpenAI Responses stream failure proving retry recovery through a live or mocked streaming provider.
- TUI/headless visible indication that a stream error retry happened.

## Known risks / regressions

- Provider stream-error chunk shapes can drift; OpenAI Responses matching depends on error code/type text.
- Retrying after partial streamed output can be confusing unless the UI/history path avoids duplicate visible content.
- Custom matchers must be conservative; overly broad matchers can retry fatal errors and mask real failures.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
