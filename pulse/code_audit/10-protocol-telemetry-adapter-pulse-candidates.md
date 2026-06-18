# Protocol, Telemetry, and Adapter Pulse Candidate Audit

Scope: `packages/core/src`.

This file continues the Pulse candidate audit with smaller source areas that still have important observability gaps: remote A2A agents, AI SDK ToolLoopAgent adaptation, Agent Builder policy derivation, telemetry, logging adapters, request-context re-exports, and action primitives.

Working heuristic: capture remote protocol boundaries, adapter decisions, policy filtering, telemetry drop/fallback behavior, and log dual-write behavior.

## `a2a`

Files inspected:

- `packages/core/src/a2a/a2a-agent.ts`
- `packages/core/src/a2a/error.ts`
- `packages/core/src/a2a/types.ts`
- `packages/core/src/a2a/client.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `a2a/a2a-agent.ts:113` | SSE event block parsing | `a2a.stream_event_parsed`, `a2a.stream_event_parse_skipped`, `a2a.stream_done_received` | Remote stream parsing can silently skip malformed blocks. |
| `a2a/a2a-agent.ts:180` | prompt conversion | `a2a.prompt_built` | Mastra messages/context/instructions are flattened into a remote prompt string. |
| `a2a/a2a-agent.ts:250` | response messages | `a2a.response_messages_created` | Remote text is converted back into Mastra DB messages. |
| `a2a/a2a-agent.ts:283` | result unwrap | `a2a.result_unwrapped`, `a2a.invalid_response` | JSON-RPC and raw result shapes are normalized. |
| `a2a/a2a-agent.ts:345` | constructor | `a2a.agent_created` | Captures URL, retry/backoff, credentials mode, timeout, and custom fetch presence without secrets. |
| `a2a/a2a-agent.ts:363` | agent card load | `a2a.agent_card_requested`, `a2a.agent_card_cache_hit`, `a2a.agent_card_loaded` | Bootstrap/card is cached and controls execution URL/streaming support. |
| `a2a/a2a-agent.ts:392` | memory resolution | `a2a.memory_resolved`, `a2a.memory_missing`, `a2a.memory_resolution_failed` | A2A subagent can own dynamic memory. |
| `a2a/a2a-agent.ts:417` | `generate(...)` | `a2a.generate_started`, `a2a.generate_completed`, `a2a.generate_failed` | Remote generate boundary. |
| `a2a/a2a-agent.ts:431` | `resumeGenerate(...)` run state lookup | `a2a.resume_generate_started`, `a2a.resume_state_missing`, `a2a.resume_state_invalid` | Resume requires saved task/context state. |
| `a2a/a2a-agent.ts:455` | waiting-for-input resume | `a2a.input_resume_sent` | Resume data becomes a prompt to the remote task context. |
| `a2a/a2a-agent.ts:467` | task polling resume | `a2a.task_resume_polled` | Non-input resumptions fetch task state instead of sending new input. |
| `a2a/a2a-agent.ts:481` | `stream(...)` | `a2a.stream_started`, `a2a.stream_completed`, `a2a.stream_failed` | Remote streaming boundary. |
| `a2a/a2a-agent.ts:489` | unsupported streaming fallback | `a2a.stream_fallback_buffered_generate` | Falls back to generate + buffered stream when remote agent lacks streaming. |
| `a2a/a2a-agent.ts:500` | `resumeStream(...)` | `a2a.resume_stream_started`, `a2a.resume_stream_failed` | Streaming resume branch. |
| `a2a/a2a-agent.ts:518` | unsupported streaming resume fallback | `a2a.resume_stream_fallback_buffered_generate` | Resume stream can fall back to buffered generate. |
| `a2a/a2a-agent.ts:532` | resubscribe branch | `a2a.task_resubscribe_started` | Resubscribes to an existing remote task stream. |
| `a2a/a2a-agent.ts:537` | `#getBootstrap(...)` card verification | `a2a.agent_card_verification_started`, `a2a.agent_card_verification_completed`, `a2a.agent_card_verification_failed` | Custom card verifier can reject bootstrap. |
| `a2a/a2a-agent.ts:567` | `message/send` request | `a2a.message_send_started`, `a2a.message_send_completed`, `a2a.message_send_failed` | Main JSON-RPC send method. |
| `a2a/a2a-agent.ts:629` | task resolution loop | `a2a.task_evaluated`, `a2a.task_poll_scheduled`, `a2a.task_poll_completed` | Long-running remote tasks are polled until completion/input-required/suspension. |
| `a2a/a2a-agent.ts:673` | task evaluator | `a2a.task_completed`, `a2a.task_input_required`, `a2a.task_suspended_nonterminal` | Converts remote task status to local result or suspend state. |
| `a2a/a2a-agent.ts:718` | `message/stream` request | `a2a.message_stream_started` | Starts remote SSE stream. |
| `a2a/a2a-agent.ts:747` | `tasks/resubscribe` request | `a2a.task_resubscribe_requested` | Reattaches to remote task stream. |
| `a2a/a2a-agent.ts:776` | stream tee and accumulation | `a2a.stream_consumption_started`, `a2a.stream_accumulated`, `a2a.stream_accumulation_failed` | One stream feeds user chunks while the other builds final result/run state. |
| `a2a/a2a-agent.ts:846` | streamed chunk emission | `a2a.stream_text_started`, `a2a.stream_text_delta`, `a2a.stream_text_ended`, `a2a.stream_suspended`, `a2a.stream_finished` | Converts remote events to Mastra stream chunks. |
| `a2a/a2a-agent.ts:1044` | collect final stream result | `a2a.stream_result_collected`, `a2a.stream_result_suspended` | Accumulator builds final text/task/suspend result. |
| `a2a/a2a-agent.ts:1138` | buffered stream result | `a2a.buffered_stream_created` | Synthesizes stream chunks from a non-streaming result. |
| `a2a/a2a-agent.ts:1202` | request retry loop | `a2a.request_started`, `a2a.request_completed`, `a2a.request_failed`, `a2a.request_retry_scheduled`, `a2a.request_retry_exhausted` | HTTP/JSON-RPC transport with retry/backoff and status handling. |
| `a2a/a2a-agent.ts:1261` | request signal resolution | `a2a.request_signal_resolved`, `a2a.request_timeout_attached` | Combines operation signal, agent abort signal, and timeout. |
| `a2a/error.ts:20` | A2A error construction | `a2a.error_created`, `a2a.error_jsonrpc_serialized` | Error codes/data/task id are protocol-significant. |

Notes:

- A2A is mostly uninstrumented in the traditional span/log/metric sense and is a strong Pulse candidate because remote execution is long-running, resumable, and protocol-driven.
- Candidate data: retry attempt, backoff ms, stream chunk count, task poll count.
- Candidate attributes: A2A agent id/name, card URL, execution URL host, JSON-RPC method, run id, task id, context id, task state.

## `tool-loop-agent`

Files inspected:

- `packages/core/src/tool-loop-agent/index.ts`
- `packages/core/src/tool-loop-agent/tool-loop-processor.ts`
- `packages/core/src/tool-loop-agent/utils.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `tool-loop-agent/index.ts:38` | conversion entry | `tool_loop_agent.conversion_started`, `tool_loop_agent.converted` | AI SDK v6 ToolLoopAgent becomes a Mastra Agent with a processor. |
| `tool-loop-agent/index.ts:39` | id fallback | `tool_loop_agent.id_generated` | Missing id falls back to option/default generated id. |
| `tool-loop-agent/tool-loop-processor.ts:44` | processor construction | `tool_loop_processor.created` | Captures source agent settings and processor id. |
| `tool-loop-agent/tool-loop-processor.ts:49` | config extraction | `tool_loop_processor.agent_config_resolved` | Maps AI SDK settings to Mastra agent config/default options. |
| `tool-loop-agent/tool-loop-processor.ts:128` | prepare result mapping | `tool_loop_processor.prepare_result_mapped` | Converts prepareCall/prepareStep outputs into Mastra processor overrides. |
| `tool-loop-agent/tool-loop-processor.ts:222` | `prepareCall` hook | `tool_loop_processor.prepare_call_started`, `tool_loop_processor.prepare_call_completed`, `tool_loop_processor.prepare_call_failed` | User hook can override model/tools/settings before first step. |
| `tool-loop-agent/tool-loop-processor.ts:265` | `prepareStep` model override resolution | `tool_loop_processor.prepare_step_model_resolved`, `tool_loop_processor.prepare_step_model_unsupported` | PrepareStep can return unsupported model versions. |
| `tool-loop-agent/tool-loop-processor.ts:298` | `prepareStep` hook | `tool_loop_processor.prepare_step_started`, `tool_loop_processor.prepare_step_completed`, `tool_loop_processor.prepare_step_failed` | Runs every agent step. |
| `tool-loop-agent/tool-loop-processor.ts:306` | `processInputStep(...)` | `tool_loop_processor.input_step_processed`, `tool_loop_processor.input_step_noop` | Emits processor overrides or no-op. |

Notes:

- This is an adapter layer; Pulse should record adaptation decisions but avoid duplicating downstream agent/model/tool pulses.
- Candidate attributes: source agent id, generated agent id, step number, overridden fields.

## `agent-builder/ee`

Files inspected:

- `packages/core/src/agent-builder/ee/picker.ts`
- `packages/core/src/agent-builder/ee/policy.ts`
- `packages/core/src/agent-builder/ee/allowlist.ts`
- `packages/core/src/agent-builder/ee/normalize-candidate.ts`
- `packages/core/src/agent-builder/ee/errors.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `agent-builder/ee/picker.ts:31` | one allowlist resolution | `agent_builder.allowlist_resolved`, `agent_builder.allowlist_warning_unknown_id` | Unknown tools/agents/workflows are hidden with non-fatal warnings. |
| `agent-builder/ee/picker.ts:66` | picker visibility resolution | `agent_builder.picker_visibility_resolved` | Determines visible tools/agents/workflows in builder UI. |
| `agent-builder/ee/policy.ts:27` | model policy activation predicate | `agent_builder.model_policy_activation_checked` | Decides whether model restrictions are active. |
| `agent-builder/ee/policy.ts:49` | builder-to-policy derivation | `agent_builder.model_policy_resolved`, `agent_builder.model_policy_inactive` | Model picker/allowlist/default policy affects runtime UI and enforcement. |
| `agent-builder/ee/allowlist.ts` | allowlist validation/enforcement | `agent_builder.allowlist_checked`, `agent_builder.allowlist_denied` | Server-side enforcement should be observable when it blocks a candidate. |
| `agent-builder/ee/normalize-candidate.ts` | candidate normalization | `agent_builder.candidate_normalized`, `agent_builder.candidate_invalid` | User/builder-supplied model candidates are normalized before policy checks. |
| `agent-builder/ee/errors.ts` | error creation | `agent_builder.error_created` | Builder-specific errors should retain policy/candidate context. |

Notes:

- These are mostly decision pulses rather than logs/metrics. They explain why recent builder UI/runtime choices are visible, hidden, allowed, or rejected.

## Telemetry and Logging

Files inspected:

- `packages/core/src/telemetry/posthog.ts`
- `packages/core/src/telemetry/usage-telemetry.ts`
- `packages/core/src/logger/default-logger.ts`
- `packages/core/src/logger/dual-logger.ts`
- `packages/core/src/logger/multi-logger.ts`
- `packages/core/src/logger/logger.ts`
- `packages/core/src/logger/transport.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `telemetry/posthog.ts:16` | telemetry disabled check | `telemetry.enabled_checked`, `telemetry.disabled_by_env` | EE telemetry can be disabled by env var. |
| `telemetry/posthog.ts:20` | value hashing | `telemetry.value_hashed` | Telemetry anonymization path. |
| `telemetry/posthog.ts:37` | PostHog client creation | `telemetry.client_created`, `telemetry.client_skipped_disabled` | Client is lazy and disabled-safe. |
| `telemetry/posthog.ts:63` | capture event | `telemetry.event_capture_started`, `telemetry.event_captured`, `telemetry.event_dropped_disabled`, `telemetry.event_capture_failed_ignored` | Capture failures are intentionally swallowed. |
| `logger/default-logger.ts:5` | deprecated `createLogger` | `logger.deprecated_create_logger_called` | Emits a warning today; useful migration signal. |
| `logger/dual-logger.ts:33` | classic logger methods | `logger.dual_write_started`, `logger.dual_write_completed`, `logger.dual_write_failed_ignored` | Existing `IMastraLogger` calls are forwarded to loggerVNext when available. |
| `logger/dual-logger.ts:53` | exception tracking | `logger.exception_tracked`, `logger.exception_forwarded`, `logger.exception_forward_failed_ignored` | Exceptions are written to both logger systems. |
| `logger/dual-logger.ts:103` | loggerVNext resolution | `logger.vnext_resolved_correlated`, `logger.vnext_resolved_global`, `logger.vnext_missing` | Chooses span-correlated logger, global logger, or none. |
| `logger/dual-logger.ts:124` | arg adaptation | `logger.args_adapted_for_vnext` | Variadic args/errors are converted to structured data. |
| `logger/multi-logger.ts:8` | fan-out logging | `logger.multi_write_started`, `logger.multi_write_completed` | One log call is forwarded to many loggers. |
| `logger/multi-logger.ts:42` | list logs fallback | `logger.multi_list_logs_started`, `logger.multi_list_logs_hit`, `logger.multi_list_logs_empty` | Reads transports in order until one returns rows. |

Notes:

- Telemetry is external product telemetry, not user observability. Pulse should likely keep this separate unless we need internal self-observation while developing Pulse.
- Logger dual-write is a current bridge from traditional logs to observability storage; Pulse could either replace this bridge or consume the same normalized structured data.

## `request-context`, `action`, `voice`, `tts`, and `error`

Files inspected:

- `packages/core/src/request-context/index.ts`
- `packages/core/src/action/index.ts`
- `packages/core/src/voice/*`
- `packages/core/src/tts/index.ts`
- `packages/core/src/error/*`

| Area | Candidate Pulse | Why |
| --- | --- | --- |
| `request-context/index.ts` | `request_context.created`, `request_context.merged`, `request_context.version_overrides_merged` | Local package re-exports the internal request-context implementation; many higher-level Pulse candidates depend on context identity/version metadata. |
| `action/index.ts` | `mastra_primitives.resolved` | Tool/action contexts receive logger/storage/agents/tts/vectors/memory primitives; useful for debugging missing capabilities. |
| `voice/*` and `tts/index.ts` | `voice.speech_started`, `voice.speech_completed`, `voice.transcription_started`, `voice.transcription_completed`, `voice.provider_failed` | Local package mostly re-exports internal voice/TTS implementations; existing tests around serialize-for-span suggest voice should have Pulse equivalents where implementations execute. |
| `error/*` | `error.normalized`, `error.serialized`, `error.safe_parse_failed` | Local package re-exports internal error utilities. Error normalization is a natural Pulse `error` input path. |

Notes:

- These areas are thin re-exports or types in `packages/core/src`, so the detailed behavior lives in internal packages. If Pulse instrumentation is added at the package boundary, this is where context/error/voice events would be made visible to core callers.
