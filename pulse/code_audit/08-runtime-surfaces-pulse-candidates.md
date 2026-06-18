# Runtime Surfaces Pulse Candidate Audit

Scope: `packages/core/src`.

This file continues the Pulse candidate audit with runtime surfaces that sit between the agent/workflow loops and infrastructure: tool execution, task-list tools, model routing, model transports, and validation/conversion layers.

Working heuristic: capture decisions and state transitions that currently appear only as return values, warnings, thrown errors, hidden provider metadata, or stream chunks.

## `tools`

Files inspected:

- `packages/core/src/tools/tool.ts`
- `packages/core/src/tools/tool-builder/builder.ts`
- `packages/core/src/tools/stream.ts`
- `packages/core/src/tools/payload-transform.ts`
- `packages/core/src/tools/validation.ts`
- `packages/core/src/tools/provider-tool-utils.ts`
- `packages/core/src/tools/toolchecks.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `tools/tool.ts:305` | `Tool` constructor wraps user `execute` | `tool.instance_created` | Tool ids, schemas, approval settings, MCP metadata, transforms, and hooks define the executable surface. |
| `tools/tool.ts:327` | raw input validation before user execute | `tool.input_validated`, `tool.input_validation_failed` | Validation failures return structured errors rather than throwing. |
| `tools/tool.ts:334` | request context validation | `tool.request_context_validated`, `tool.request_context_validation_failed` | Request context schema failures are currently returned as tool outputs. |
| `tools/tool.ts:346` | suspend interception | `tool.suspend_requested` | Captures the moment a user tool asks the run to pause. |
| `tools/tool.ts:357` | execution context normalization | `tool.execution_context_resolved` | Direct, agent, and workflow executions are normalized into different context shapes. |
| `tools/tool.ts:439` | resume data validation | `tool.resume_data_validated`, `tool.resume_data_validation_failed` | Resume payload validation is separate from input validation. |
| `tools/tool.ts:447` | call original execute | `tool.execute_started`, `tool.execute_completed`, `tool.execute_failed` | The core execution boundary should be visible independent of span semantics. |
| `tools/tool.ts:450` | suspend data validation after execute | `tool.suspend_data_validated`, `tool.suspend_data_validation_failed` | Invalid suspend payloads are discovered after the tool has already run. |
| `tools/tool.ts:461` | output validation | `tool.output_validated`, `tool.output_validation_failed` | Invalid tool output is currently returned as a validation object. |
| `tools/tool-builder/builder.ts:53` | merge closure/execution `RequestContext` | `tool.request_context_merged` | Restores non-serializable context across evented workflow serialization. |
| `tools/tool-builder/builder.ts:247` | background/resume override schema injection | `tool.schema_override_injected`, `tool.schema_override_skipped` | Adds `_background`, `suspendedToolRunId`, and `resumeData` into tool input schemas. |
| `tools/tool-builder/builder.ts:399` | provider-defined tool conversion | `tool.provider_defined_converted`, `tool.provider_defined_conversion_failed` | Provider tools are converted into CoreTool shape and may gain execute wrappers. |
| `tools/tool-builder/builder.ts:524` | get-or-create tool span | `tool.observability_context_created` | Traditional span emission already exists here; Pulse should probably own the same boundary. |
| `tools/tool-builder/builder.ts:548` | tool FGA check | `tool.authz_checked`, `tool.authz_allowed`, `tool.authz_denied` | Tool execution can be blocked before validation/execution. |
| `tools/tool-builder/builder.ts:584` | debug log before execution | `tool.execution_logged` | Traditional log event currently exists here through logger debug. |
| `tools/tool-builder/builder.ts:589` | converted input validation | `tool.input_validated`, `tool.input_validation_failed` | Builder-level validation runs before calling the wrapped execution function. |
| `tools/tool-builder/builder.ts:602` | delayed execution dispatch | `tool.execution_scheduled` | `setImmediate` creates a deferred dispatch point that can matter for stream readiness. |
| `tools/tool-builder/builder.ts:621` | tool execution failure mapping | `tool.execution_failed`, `tool.error_normalized` | Unknown errors become `MastraError` with domain/category/details and are tracked by logger. |
| `tools/tool-builder/builder.ts:650` | `buildV5()` provider-defined conversion | `tool.v5_built`, `tool.provider_defined_v5_built` | V5 shape strips execute from provider-defined tools and resolves model-facing names. |
| `tools/tool-builder/builder.ts:692` | schema compatibility layer choice | `tool.schema_compat_layer_selected`, `tool.schema_compat_layer_skipped` | Model/provider-specific schema compatibility changes what the model sees. |
| `tools/tool-builder/builder.ts:755` | approval config resolution | `tool.approval_policy_resolved` | Static, dynamic, AI SDK, and MCP approval policies are merged. |
| `tools/stream.ts:28` | `ToolStream.write(...)` | `tool.stream_output_written` | User code can emit tool output chunks through writer. |
| `tools/stream.ts:53` | `ToolStream.custom(...)` | `tool.stream_custom_chunk_written` | Tools can emit arbitrary data chunks into the run stream. |
| `tools/payload-transform.ts:63` | transform target configured | `tool_payload_transform.configured`, `tool_payload_transform.skipped` | Display/transcript transforms can suppress or replace payloads. |
| `tools/payload-transform.ts:81` | transformer execution | `tool_payload_transform.completed`, `tool_payload_transform.failed` | Transform errors currently log warnings and substitute placeholders. |
| `tools/payload-transform.ts:104` | per-target transform | `tool_payload_transform.targets_resolved` | Display and transcript targets can diverge. |
| `tools/validation.ts:149` | suspend data validation | `tool.suspend_data_validation_failed` | Adds formatted validation errors and truncated arguments. |
| `tools/validation.ts:421` | input validation pipeline | `tool.input_normalized`, `tool.input_coerced`, `tool.input_alias_resolved`, `tool.input_validation_failed` | Several LLM-output repair steps are attempted before returning an error. |
| `tools/validation.ts:543` | output validation | `tool.output_validation_failed` | Output validation failures include truncated returned output. |
| `tools/provider-tool-utils.ts:7` | provider tool lookup | `provider_tool.lookup_completed`, `provider_tool.lookup_missed` | Maps model-facing names back to provider-defined tools. |
| `tools/provider-tool-utils.ts:18` | provider-executed inference | `provider_tool.provider_executed_inferred` | Missing `providerExecuted` stream metadata is inferred from tool shape. |

Notes:

- Tool execution already has traditional spans and logs in `CoreToolBuilder`, but much of the meaningful behavior is in validation, context reshaping, approval resolution, transform decisions, and best-effort warning paths.
- Candidate data: input validation issue count, transform target count, output chunk size, schema compatibility layer count, approval policy type.
- Candidate attributes: tool id/name, tool type, agent id, workflow id, run id, thread id, MCP server name, provider tool id.

## Built-In Interaction and Task Tools

Files inspected:

- `packages/core/src/tools/builtin/ask-user.ts`
- `packages/core/src/tools/builtin/submit-plan.ts`
- `packages/core/src/tools/builtin/task-tools.ts`
- `packages/core/src/tools/builtin/task-state-processor.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `tools/builtin/ask-user.ts:99` | selection mode validation | `ask_user.validation_failed` | Invalid option/selection combinations return model-visible errors. |
| `tools/builtin/ask-user.ts:107` | resume answer received | `ask_user.resumed` | User answer becomes a model-facing tool result. |
| `tools/builtin/ask-user.ts:112` | suspend prompt emitted | `ask_user.suspended` | The run pauses awaiting human input. |
| `tools/builtin/ask-user.ts:118` | no suspend fallback | `ask_user.direct_fallback_returned` | Direct execution returns a readable prompt instead of pausing. |
| `tools/builtin/submit-plan.ts:73` | resume decision received | `submit_plan.resumed`, `submit_plan.approved`, `submit_plan.rejected` | Plan approval/rejection is a human decision point. |
| `tools/builtin/submit-plan.ts:91` | suspend plan emitted | `submit_plan.suspended` | The run pauses for plan review. |
| `tools/builtin/submit-plan.ts:97` | no suspend fallback | `submit_plan.direct_fallback_returned` | Direct execution returns a readable plan. |
| `tools/builtin/task-tools.ts:335` | thread-state store resolution | `task_store.resolved`, `task_store.missing` | Task tools silently no-op if memory/thread state is unavailable. |
| `tools/builtin/task-tools.ts:345` | Harness display bridge | `task_display_update.emitted`, `task_display_update_skipped` | Task changes are projected to Harness UI separately from storage/state signals. |
| `tools/builtin/task-tools.ts:364` | read current tasks | `task_list.read`, `task_list.read_failed` | The durable task list is read before each mutation/check. |
| `tools/builtin/task-tools.ts:374` | apply task mutation | `task_list.mutation_started`, `task_list.mutation_persisted`, `task_list.mutation_failed` | Task writes update storage, request context, and display state. |
| `tools/builtin/task-tools.ts:421` | `task_write` replace list | `task_list.replaced`, `task_list.replace_rejected` | Full-list replacement can fail due to multiple in-progress tasks. |
| `tools/builtin/task-tools.ts:480` | `task_update` by id | `task.updated`, `task.update_rejected_missing_id` | Missing task ids return actionable model-visible errors. |
| `tools/builtin/task-tools.ts:535` | `task_complete` by id | `task.completed`, `task.complete_rejected_missing_id` | Completion is a state transition worth observing. |
| `tools/builtin/task-tools.ts:585` | `task_check` summary | `task_list.checked` | Provides counts and `allCompleted` decision used before finishing. |
| `tools/builtin/task-state-processor.ts:179` | resolve task state store | `task_state_processor.store_resolved`, `task_state_processor.store_missing` | Processor falls back to prior state when store is absent. |
| `tools/builtin/task-state-processor.ts:183` | compute task signal | `task_state_signal.compute_started`, `task_state_signal.compute_skipped`, `task_state_signal.snapshot_emitted`, `task_state_signal.delta_emitted` | State-signal emission decides snapshot vs delta vs no-op. |
| `tools/builtin/task-state-processor.ts:207` | carried request context tasks | `task_state_signal.request_context_used` | Same-step task mutations override durable store reads. |
| `tools/builtin/task-state-processor.ts:221` | no tasks to track | `task_state_signal.skipped_empty` | Explicit no-op branch. |
| `tools/builtin/task-state-processor.ts:229` | compaction/OM decision | `task_state_signal.snapshot_required`, `task_state_signal.delta_allowed` | Snapshot is forced when base is missing, OM dropped it, or delta cap is reached. |

Notes:

- These are especially Pulse-shaped because they mix `input`/`decision`/`output` events with human pauses and durable state transitions.
- Candidate data: task count, completed/in-progress/pending counts, delta op count, selected option count.
- Candidate attributes: task id, state signal id, thread id, resource id, selection mode, plan title.

## `llm/model` Routing and Transport

Files inspected:

- `packages/core/src/llm/model/resolve-model.ts`
- `packages/core/src/llm/model/model-auth-resolver.ts`
- `packages/core/src/llm/model/router.ts`
- `packages/core/src/llm/model/embedding-router.ts`
- `packages/core/src/llm/model/server-side-fallback.ts`
- `packages/core/src/llm/model/openai-websocket-fetch.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `llm/model/resolve-model.ts:84` | dynamic model function | `model_config.dynamic_resolved`, `model_config.dynamic_failed` | Runtime request context can select the model. |
| `llm/model/resolve-model.ts:95` | existing wrapped model | `model_config.already_wrapped` | Avoids wrapping and can explain missing router behavior. |
| `llm/model/resolve-model.ts:103` | language model wrapping by specification | `model_config.wrapped_v1`, `model_config.wrapped_v2`, `model_config.wrapped_v3`, `model_config.wrapped_unknown_spec` | Wrapper choice affects serialization and execution behavior. |
| `llm/model/resolve-model.ts:128` | custom gateway list | `model_config.custom_gateways_resolved` | Mastra instance gateways affect router selection. |
| `llm/model/resolve-model.ts:132` | router model creation | `model_router.created` | Magic strings/OpenAI-compatible config become router-backed models. |
| `llm/model/resolve-model.ts:136` | invalid config | `model_config.invalid` | Throws before any model call. |
| `llm/model/model-auth-resolver.ts:26` | explicit auth path | `model_auth.explicit_used` | Explicit api key/headers/bearer token bypass gateway auth. |
| `llm/model/model-auth-resolver.ts:30` | gateway auth path | `model_auth.gateway_used` | Gateway-supplied credentials can include bearer-token headers. |
| `llm/model/model-auth-resolver.ts:37` | legacy api-key fallback | `model_auth.legacy_used` | Older gateway auth path. |
| `llm/model/router.ts:154` | constructor gateway selection | `model_router.gateway_selected` | Gateway id/provider/model parsing is a core routing decision. |
| `llm/model/router.ts:225` | supported URL resolution | `model_router.supported_urls_resolved`, `model_router.supported_urls_failed` | Failure is swallowed and returns `{}`. |
| `llm/model/router.ts:332` | router auth resolution | `model_auth.resolved`, `model_auth.failed` | Auth failure currently becomes an error stream in generate/stream paths. |
| `llm/model/router.ts:395` | `doGenerate(...)` auth failure | `model_generate.error_stream_returned` | Generate does not throw; it returns a stream containing an error part. |
| `llm/model/router.ts:414` | model instance resolution for generate | `model_generate.model_resolved` | Resolves concrete gateway model and wrapper before generation. |
| `llm/model/router.ts:427` | `doStream(...)` auth failure | `model_stream.error_stream_returned` | Stream auth failure is represented as a model stream error. |
| `llm/model/router.ts:446` | transport decision | `model_stream.transport_resolved` | Chooses `fetch` vs `websocket` based on provider options, gateway, provider, and custom URL. |
| `llm/model/router.ts:459` | stream transport attachment | `model_stream.transport_attached` | Exposes transport handle for consumers to close/reuse. |
| `llm/model/router.ts:487` | model cache lookup | `model_router.cache_hit`, `model_router.cache_miss` | Instance/global cache choice and cache key decide model reuse. |
| `llm/model/router.ts:512` | custom URL OpenAI-compatible model | `model_router.custom_url_model_created` | Skips registry/gateway resolution. |
| `llm/model/router.ts:522` | OpenAI websocket model path | `model_router.websocket_model_created`, `model_router.websocket_model_cached` | Special transport path for OpenAI Responses streaming. |
| `llm/model/router.ts:543` | gateway model resolution | `model_router.gateway_model_resolved`, `model_router.gateway_model_failed` | External gateway returns the concrete model and optional stream transport. |
| `llm/model/embedding-router.ts:118` | embedding model config parsing | `embedding_model.config_parsed`, `embedding_model.config_invalid` | Provider/model string parsing throws on invalid formats. |
| `llm/model/embedding-router.ts:171` | Mastra gateway API key resolution | `embedding_model.auth_resolved`, `embedding_model.auth_missing` | Missing gateway key throws during construction. |
| `llm/model/embedding-router.ts:187` | custom URL embedding model | `embedding_model.custom_url_created` | Skips registry validation. |
| `llm/model/embedding-router.ts:199` | provider registry lookup | `embedding_model.provider_resolved`, `embedding_model.provider_unknown` | Unknown providers throw. |
| `llm/model/embedding-router.ts:207` | env var API key lookup | `embedding_model.env_auth_resolved`, `embedding_model.env_auth_missing` | Multiple env vars may be tried. |
| `llm/model/embedding-router.ts:242` | `doEmbed(...)` | `embedding.started`, `embedding.completed`, `embedding.failed`, `embedding.warnings_normalized` | Embedding calls are external model calls but warnings are normalized locally. |
| `llm/model/server-side-fallback.ts:20` | fallback metadata detection | `model.server_side_fallback_detected` | Anthropic fallback can change which model actually served a turn. |
| `llm/model/server-side-fallback.ts:43` | response model id resolution | `model.response_model_resolved` | Attribution prefers fallback model over response model id. |
| `llm/model/openai-websocket-fetch.ts:71` | websocket connection key reuse | `openai_websocket.connection_reused`, `openai_websocket.connection_replaced` | Persistent socket reuse depends on auth/header key. |
| `llm/model/openai-websocket-fetch.ts:104` | websocket open/error/close before open | `openai_websocket.opened`, `openai_websocket.open_failed`, `openai_websocket.closed_before_open` | Transport lifecycle is currently hidden. |
| `llm/model/openai-websocket-fetch.ts:148` | request fallback to HTTP | `openai_websocket.http_fallback` | Non-stream, non-POST, non-responses, invalid JSON, or busy-safe requests use fetch. |
| `llm/model/openai-websocket-fetch.ts:165` | overlapping stream decision | `openai_websocket.overlap_rejected`, `openai_websocket.overlap_http_fallback` | Concurrent continuation is rejected, other overlap falls back to HTTP. |
| `llm/model/openai-websocket-fetch.ts:212` | response frame forwarding | `openai_websocket.frame_received`, `openai_websocket.terminal_event_received` | Websocket frames are converted into SSE data chunks. |
| `llm/model/openai-websocket-fetch.ts:222` | stream error/close/abort | `openai_websocket.stream_error`, `openai_websocket.stream_closed`, `openai_websocket.stream_aborted` | Stream failure/cleanup behavior is critical for long-running model streams. |
| `llm/model/openai-websocket-fetch.ts:285` | explicit close | `openai_websocket.closed` | Consumer can close the persistent socket. |

Notes:

- Router decisions are mostly hidden behind object construction and wrapper selection. Pulse should expose the routing outcome without leaking credentials.
- Candidate data: cache hit count, stream frame count, transport type, warning count.
- Candidate attributes: router id, gateway id, provider id, model id, auth source, transport, websocket close-on-finish.
