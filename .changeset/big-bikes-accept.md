---
'@mastra/observability': patch
'@mastra/inngest': patch
'@mastra/core': patch
---

Scope down processor span input/output to a safe allow-list.

**What changed**

Processor phases (`input`, `inputStep`, `outputResult`, `outputStep`, `outputStream`) internally carry a `passThrough` / `stepInput` object that holds the model instance, tools, `providerOptions`, `modelSettings`, `structuredOutput`, `processorStates`, and arbitrary per-processor `state`. That object was being dumped into PROCESSOR_RUN span input and output.

Observability spans now receive only a fixed allow-list of safe, debugging-useful fields via a new `projectProcessorSpanPayload` helper: `phase`, `messages`, `systemMessages`, `stepNumber`, `messageId`, `retryCount`, `finishReason`, `text`, `toolCalls`, `toolChoice`, `activeTools`, `usage`, `tripwire`, `part`, `messageListMutations`, `result`.

Fields containing credentials or internal state (`tools`, `modelSettings`, `providerOptions`, `structuredOutput`, `state`, `processorStates`, `messageList`, `rotateResponseMessageId`, `requestContext`, `writer`, `abortSignal`) are no longer forwarded to spans. New fields added to the processor context must be explicitly added to the allow-list — they will not silently appear in spans.

**Why**

TypeScript-`private` fields like `ModelRouterLanguageModel.config` (holding `apiKey`) are enumerable at runtime and were being serialized into PROCESSOR_RUN span output whenever a model flowed through `passThrough`. `modelSettings.headers` and `providerOptions.*` may also carry user-supplied Authorization headers. An allow-list is safer than a deny-list because new fields cannot accidentally leak.

`projectProcessorSpanPayload` and `SAFE_PROCESSOR_SPAN_FIELDS` are exported from `@mastra/core/processors` for downstream workflow packages.
