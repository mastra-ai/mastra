# Deeper Core Pulse Candidate Audit

Scope: `packages/core/src`.

This file continues the broad Pulse candidate pass from `06-file-by-file-pulse-candidates.md`. It focuses on directories that were previously called out as needing deeper follow-up rather than only coarse coverage.

Working heuristic is unchanged: record lifecycle boundaries, decisions, external calls, queue/state transitions, persistence behavior, and error normalization that could become Pulse events.

## `memory`

Files inspected:

- `packages/core/src/memory/memory.ts`
- `packages/core/src/memory/types.ts`
- `packages/core/src/memory/working-memory-utils.ts`
- `packages/core/src/memory/system-reminders.ts`
- `packages/core/src/memory/mock.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `memory/types.ts:136` | `parseMemoryRequestContext(...)` | `memory_context.parsed`, `memory_context.invalid`, `memory_context.missing` | Runtime memory context controls thread/resource scoping and can throw on malformed context. |
| `memory/types.ts:83` | `getThreadOMMetadata(...)` | `observational_memory.thread_metadata_read` | Thread OM metadata is a hidden state source for task, response suggestions, titles, and cursors. |
| `memory/types.ts:99` | `setThreadOMMetadata(...)` | `observational_memory.thread_metadata_updated` | Updates nested Mastra OM metadata on a thread. |
| `memory/types.ts` | observational memory config thresholds | `observational_memory.config_resolved` | Token thresholds, buffering, block-after, reflection, retrieval, and title config decide whether work is sync, async, or skipped. |
| `memory/memory.ts:494` | `createThread(...)` | `memory.thread_created`, `memory.thread_create_skipped_save`, `memory.thread_create_failed` | Creates a thread id, title, metadata, and optionally persists it. |
| `memory/memory.ts:535` | `updateThread(...)` | `memory.thread_updated`, `memory.thread_update_failed` | Thread title/metadata changes are user-visible and may affect OM/working memory. |
| `memory/memory.ts:548` | `deleteThread(...)` | `memory.thread_deleted`, `memory.thread_delete_failed` | Deleting a thread removes execution context and should be observable. |
| `memory/memory.ts:565` | deprecated `addMessage(...)` | `memory.deprecated_add_message_called` | Deprecated path throws immediately; useful to catch old integrations. |
| `memory/memory.ts:592` | `checkThreadFGA(...)` | `memory.thread_authz_checked`, `memory.thread_authz_allowed`, `memory.thread_authz_denied` | Memory access can be denied by FGA before thread operations. |
| `memory/memory.ts:641` | `getWorkingMemory(...)` | `working_memory.read`, `working_memory.read_failed` | Reads thread/resource-scoped working memory. |
| `memory/memory.ts:657` | `getWorkingMemoryTemplate(...)` | `working_memory.template_read`, `working_memory.template_missing` | Template affects prompt/tool instructions. |
| `memory/memory.ts:663` | `updateWorkingMemory(...)` | `working_memory.updated`, `working_memory.update_failed` | Working memory mutation is a durable state change caused by the model. |
| `memory/memory.ts:680` | `__experimental_updateWorkingMemoryVNext(...)` | `working_memory.vnext_updated`, `working_memory.vnext_update_failed` | Experimental state-signal working memory path should be distinguishable from legacy. |
| `memory/memory.ts:700` | `getInputProcessors(...)` | `memory.input_processors_resolved`, `memory.input_processor_resolution_failed` | Memory dynamically attaches processors based on config and runtime context. |
| `memory/memory.ts:725` | missing storage for working memory | `memory.processor_resolution_failed` | Working memory requires storage; failure currently throws during setup. |
| `memory/memory.ts:763` | missing storage for message history | `memory.processor_resolution_failed` | Message history requires storage; failure should be structured. |
| `memory/memory.ts:773` | skip message history when OM handles loading | `memory.message_history_processor_skipped` | Observational memory changes which processor owns load/save. |
| `memory/memory.ts:789` | semantic recall input processor resolution | `semantic_recall.processor_resolved`, `semantic_recall.processor_resolution_failed` | Requires storage, vector adapter, and embedder. |
| `memory/memory.ts:821` | embedding dimension probe | `semantic_recall.embedding_dimension_probed`, `semantic_recall.index_name_resolved` | Dimension-aware index name affects vector recall behavior. |
| `memory/memory.ts:856` | `getOutputProcessors(...)` | `memory.output_processors_resolved`, `memory.output_processor_resolution_failed` | Memory dynamically attaches output persistence/semantic processors. |
| `memory/memory.ts:922` | missing storage for output message history | `memory.output_processor_resolution_failed` | Persistence path can fail before a run starts. |
| `memory/memory.ts:953` | `deleteMessages(...)` | `memory.messages_deleted`, `memory.messages_delete_failed` | Message deletion changes history state. |
| `memory/memory.ts:959` | clone thread method | `memory.thread_clone_started`, `memory.thread_cloned`, `memory.thread_clone_failed` | Cloning copies thread and messages. |
| `memory/memory.ts:969` | `getConfig()` serialization | `memory.config_serialized` | Emits effective memory config including vector/embedder/options without telemetry. |
| `memory/working-memory-utils.ts:44` | working memory tag extraction | `working_memory.tags_extracted` | Hidden `<working_memory>` blocks are parsed from model text. |
| `memory/working-memory-utils.ts:67` | tag removal | `working_memory.tags_removed` | Tags are stripped from persisted/visible content. |
| `memory/system-reminders.ts` | system reminder filter | `memory.system_reminders_filtered` | Signal/user system reminders are removed from history in some paths. |

Notes:

- `memory/types.ts` defines substantial observational memory behavior that is mostly configuration/state today. Pulse should probably record the decisions when OM chooses sync observation, async buffering, blocking, reflection, retrieval, or title generation.
- Candidate data: message count, token count, embedding dimension, configured thresholds, deleted count, cloned count.
- Candidate attributes: thread id, resource id, memory scope, processor id, vector index name, working-memory mode.

## `datasets` and `evals`

Files inspected:

- `packages/core/src/datasets/manager.ts`
- `packages/core/src/datasets/dataset.ts`
- `packages/core/src/datasets/validation/validator.ts`
- `packages/core/src/datasets/experiment/index.ts`
- `packages/core/src/datasets/experiment/executor.ts`
- `packages/core/src/datasets/experiment/scorer.ts`
- `packages/core/src/datasets/experiment/analytics/*`
- `packages/core/src/evals/base.ts`
- `packages/core/src/evals/hooks.ts`
- `packages/core/src/evals/run/*`
- `packages/core/src/evals/scoreTraces/*`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `datasets/manager.ts:30` | dataset store lazy resolution | `dataset.store_resolved`, `dataset.store_missing` | Dataset APIs fail when storage/domain is unavailable. |
| `datasets/manager.ts:57` | experiment store lazy resolution | `experiment.store_resolved`, `experiment.store_missing` | Experiment APIs require storage domain. |
| `datasets/manager.ts:92` | create dataset | `dataset.created`, `dataset.create_failed` | Dataset definition and scorer ids are persisted. |
| `datasets/manager.ts:127` | get dataset | `dataset.loaded`, `dataset.missing` | Missing dataset is a structured error. |
| `datasets/manager.ts:144` | list datasets | `dataset.listed` | Pagination/result count is useful for operator visibility. |
| `datasets/manager.ts:154` | delete dataset | `dataset.deleted`, `dataset.delete_failed` | Dataset deletion affects experiments and versions. |
| `datasets/manager.ts:177` | compare experiments | `experiment.compare_started`, `experiment.compare_completed`, `experiment.compare_failed` | Comparison loads runs/results and computes score deltas. |
| `datasets/validation/validator.ts:37` | schema validation | `dataset_item.validated`, `dataset_item.validation_failed` | Input/groundTruth schema failures are currently exceptions/results. |
| `datasets/validation/validator.ts:46` | batch validation | `dataset_batch.validated`, `dataset_batch.validation_failed` | Bulk schema update validation can reject existing items. |
| `datasets/dataset.ts` | item CRUD/versioning | `dataset_item.created`, `dataset_item.updated`, `dataset_item.deleted`, `dataset_version_created` | Dataset versions/items are persistent experiment inputs. |
| `datasets/experiment/index.ts:63` | `runExperiment(...)` start | `experiment.started`, `experiment.setup_failed` | Experiment resolves data source, target, scorers, and storage. |
| `datasets/experiment/index.ts:94` | setup failure marking | `experiment.mark_failed_on_setup_error`, `experiment.mark_failed_failed` | Async pre-created experiments can otherwise stay `pending`. |
| `datasets/experiment/index.ts:122` | inline data source | `experiment.data_source_inline` | Experiment uses inline items instead of stored dataset/version. |
| `datasets/experiment/index.ts:132` | dataset/version data source | `experiment.data_source_loaded`, `experiment.data_source_missing` | Loads dataset and versioned items. |
| `datasets/experiment/index.ts:186` | target resolution | `experiment.target_resolved`, `experiment.target_missing` | Target can be agent, workflow, scorer, or custom task. |
| `datasets/experiment/index.ts:253` | scorer merge/dedup | `experiment.scorers_resolved` | Dataset-attached and explicit scorers are combined. |
| `datasets/experiment/index.ts:280` | experiment record creation | `experiment.record_created`, `experiment.record_create_failed` | Persistent experiment lifecycle begins. |
| `datasets/experiment/index.ts:297` | status running update | `experiment.status_running`, `experiment.status_update_failed` | Status moves from pending to running. |
| `datasets/experiment/index.ts:320` | per-item execution | `experiment_item.started`, `experiment_item.completed`, `experiment_item.failed`, `experiment_item.aborted` | Each dataset item calls target and may retry. |
| `datasets/experiment/index.ts:338` | item retry loop | `experiment_item.retry_scheduled`, `experiment_item.retry_exhausted` | Retry decisions are per item and skip abort errors. |
| `datasets/experiment/index.ts:377` | scorer execution per item | `experiment_item.scoring_started`, `experiment_item.scoring_completed` | Scores are emitted/stored, but scoring lifecycle is separate. |
| `datasets/experiment/index.ts:421` | result persistence | `experiment_result.persisted`, `experiment_result.persist_failed` | Persist failure is warned and non-fatal. |
| `datasets/experiment/index.ts:443` | progress update | `experiment.progress_updated`, `experiment.progress_update_failed` | Progress updates are throttled and best-effort. |
| `datasets/experiment/index.ts:463` | fatal/abort summary path | `experiment.partial_summary_returned` | Fatal errors return partial summaries instead of always throwing. |
| `datasets/experiment/index.ts:498` | final status update | `experiment.completed`, `experiment.finalize_failed` | Final experiment record status and summary are persisted. |
| `datasets/experiment/scorer.ts` | scorer resolution | `experiment_scorer.resolved`, `experiment_scorer.missing` | Scorer ids/references are resolved before item scoring. |
| `datasets/experiment/scorer.ts:337` | step-scoped scorers | `experiment_step_scorer.started`, `experiment_step_scorer.skipped`, `experiment_step_scorer.failed` | Missing/failed workflow step results become scorer error records. |
| `datasets/experiment/scorer.ts:417` | best-effort score save | `experiment_score.saved`, `experiment_score.save_failed` | Save failure is currently a warning and does not fail item scoring. |
| `datasets/experiment/analytics/aggregate.ts` | aggregate experiment metrics | `experiment_analytics.aggregated` | Produces summary stats across results/scores. |
| `datasets/experiment/analytics/compare.ts` | compare experiment metrics | `experiment_analytics.compared` | Computes baseline comparisons and deltas. |
| `evals/hooks.ts:6` | `runScorer(...)` sampling | `scorer.sampling_evaluated`, `scorer.skipped_by_sampling`, `scorer.hook_dispatched` | Scorer execution can be skipped before hook emission. |
| `evals/base.ts` | scorer lifecycle | `scorer.preprocess_started`, `scorer.analyze_started`, `scorer.score_generated`, `scorer.reason_generated`, `scorer.failed` | Score emission exists, but scorer pipeline steps are useful Pulse events. |
| `evals/run/scorerAccumulator.ts:8` | score aggregation shape | `eval_scores.accumulated` | Aggregates flat, agent, workflow, and trajectory scores differently. |
| `evals/scoreTraces/*` | trace scoring | `trace_scoring.trace_loaded`, `trace_scoring.scorer_run`, `trace_scoring.score_saved`, `trace_scoring.failed` | Bridges observability traces into eval score records. |

Notes:

- Experiments are rich in Pulse `decision` and `output` events because many errors are best-effort or folded into result records instead of thrown.
- Candidate data: item count, completed/failed count, retry count, scorer count, score count, progress percent.
- Candidate attributes: dataset id/version, experiment id, target type/id, item id, scorer id, step id.

## `integration`, `tool-provider`, `processor-provider`, `relevance`

Files inspected:

- `packages/core/src/integration/integration.ts`
- `packages/core/src/integration/openapi-toolset.ts`
- `packages/core/src/tool-provider/base.ts`
- `packages/core/src/tool-provider/runtime.ts`
- `packages/core/src/tool-provider/types.ts`
- `packages/core/src/processor-provider/phase-filtered-processor.ts`
- `packages/core/src/processor-provider/providers/index.ts`
- `packages/core/src/relevance/relevance-score-provider.ts`
- `packages/core/src/relevance/mastra-agent/index.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `integration/integration.ts:16` | workflow registration | `integration.workflow_registered`, `integration.workflow_duplicate` | Integration sync/workflow registration can reject duplicate names. |
| `integration/integration.ts:40` | static tool listing | `integration.static_tools_listed`, `integration.static_tools_unimplemented` | Base implementation throws; subclasses provide tools. |
| `integration/integration.ts:44` | dynamic tool listing | `integration.tools_listed`, `integration.tools_list_failed` | Integration tool discovery is a boundary. |
| `integration/integration.ts:48` | API client creation | `integration.api_client_created`, `integration.api_client_missing` | Base class throws; subclasses may open external clients. |
| `integration/openapi-toolset.ts:26` | API client load | `openapi_toolset.client_loaded`, `openapi_toolset.client_load_failed` | OpenAPI toolset depends on generated/SDK client. |
| `integration/openapi-toolset.ts:32` | tool conversion | `openapi_toolset.tools_converted` | Client methods become Mastra tools. |
| `integration/openapi-toolset.ts:45` | generated tool execute | `openapi_tool.started`, `openapi_tool.completed`, `openapi_tool.failed` | Tool calls delegate to API client methods. |
| `tool-provider/base.ts:69` | list toolkits with allowlist | `tool_provider.toolkits_listed`, `tool_provider.toolkits_filtered` | Admin allowlists affect visible provider catalog. |
| `tool-provider/base.ts:76` | list tools with toolkit/tool allowlists | `tool_provider.tools_listed`, `tool_provider.tools_filtered`, `tool_provider.toolkit_denied` | Provider UI catalog can be filtered before SDK call. |
| `tool-provider/base.ts:119` | legacy resolve wrapper | `tool_provider.legacy_resolve_started`, `tool_provider.legacy_resolve_completed` | Legacy resolve adapts to VNext shape. |
| `tool-provider/base.ts:154` | connection fields default | `tool_provider.connection_fields_listed` | Provider-specific connection requirements surfaced to UI. |
| `tool-provider/base.ts:162` | provider health | `tool_provider.health_checked` | Health state is provider-runtime visibility. |
| `tool-provider/runtime.ts:81` | stored provider resolution start | `tool_provider.runtime_resolution_started`, `tool_provider.runtime_resolution_completed` | Agent hydration materializes executable tools from stored provider config. |
| `tool-provider/runtime.ts:92` | no providers configured | `tool_provider.runtime_resolution_skipped` | Expected no-op branch should be visible in debug mode. |
| `tool-provider/runtime.ts:100` | unknown provider | `tool_provider.unknown_provider_skipped` | Bad stored config is warned and skipped. |
| `tool-provider/runtime.ts:106` | provider missing VNext resolver | `tool_provider.unsupported_provider_skipped` | Provider lacks runtime capability. |
| `tool-provider/runtime.ts:115` | toolkit without pinned connections | `tool_provider.toolkit_skipped_no_connections` | Selected tools cannot materialize without connection. |
| `tool-provider/runtime.ts:122` | multiple connection unsupported | `tool_provider.toolkit_skipped_multiple_connections` | Provider capability mismatch changes tool availability. |
| `tool-provider/runtime.ts:133` | no matching slugs | `tool_provider.toolkit_skipped_no_tools` | Connection exists but no selected tools match toolkit. |
| `tool-provider/runtime.ts:151` | per-connection resolve | `tool_provider.connection_resolve_started`, `tool_provider.connection_resolve_completed`, `tool_provider.connection_resolve_failed` | One connection can fail without poisoning siblings. |
| `tool-provider/runtime.ts:197` | default bucket fallback warning | `tool_provider.default_bucket_fallback` | Missing resource id falls back to default author bucket. |
| `tool-provider/runtime.ts:239` | routing hint append | `tool_provider.routing_hint_appended` | Tool descriptions are modified for multi-connection disambiguation. |
| `processor-provider/phase-filtered-processor.ts` | wrapper creation | `processor_provider.phase_filter_created` | Exposes only selected processor phases. |
| `processor-provider/phase-filtered-processor.ts:64` | Mastra registration forwarding | `processor_provider.registered_mastra` | Wrapper forwards dependency registration to inner processor. |
| `processor-provider/providers/index.ts` | built-in provider config schemas | `processor_provider.config_validated`, `processor_provider.processor_created` | Provider creates configurable processors for token limits, filters, detectors, etc. |
| `relevance/mastra-agent/index.ts:28` | relevance score generation | `relevance_score.started`, `relevance_score.completed`, `relevance_score.failed` | Internal agent call returns a numeric relevance score. |
| `relevance/mastra-agent/index.ts:41` | parse float response | `relevance_score.parsed`, `relevance_score.parse_failed` | Model output is converted into a number. |

Notes:

- Tool provider runtime has many skip/partial-failure branches where operators need to know why tools are missing.
- Candidate data: provider count, toolkit count, connection count, resolved tool count, filtered count, score value.
- Candidate attributes: provider id, toolkit slug, tool slug, connection id/label, processor provider id, phase.

## `server`, `license`, `cache`, `bundler`, `deployer`, `hooks`, and related runtime infrastructure

Files inspected:

- `packages/core/src/server/*`
- `packages/core/src/license/index.ts`
- `packages/core/src/cache/*`
- `packages/core/src/bundler/*`
- `packages/core/src/deployer/*`
- `packages/core/src/hooks/*`
- `packages/core/src/features/index.ts`
- `packages/core/src/editor/types.ts`
- `packages/core/src/run/*`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `server/index.ts:78` | route option validation | `server.route_registration_failed` | Invalid route config throws before route is usable. |
| `server/index.ts:105` | `registerApiRoute(...)` | `server.route_registered` | Custom API route becomes part of server surface. |
| `server/auth.ts:52` | auth provider option registration | `auth_provider.options_registered` | Provider-level authorization function can be replaced/bound. |
| `server/simple-auth.ts:43` | token auth | `auth.simple_token_authenticated`, `auth.simple_token_rejected` | SimpleAuth checks bearer/header/cookie tokens. |
| `server/simple-auth.ts:60` | current user lookup | `auth.simple_current_user_resolved`, `auth.simple_current_user_missing` | Request-to-user mapping. |
| `server/simple-auth.ts:110` | sign in | `auth.simple_sign_in_succeeded`, `auth.simple_sign_in_failed` | Dev/simple auth creates cookie credential result. |
| `server/composite-auth.ts:142` | multi-provider authenticate | `auth.composite_auth_started`, `auth.composite_provider_authenticated`, `auth.composite_provider_failed`, `auth.composite_auth_rejected` | Composite auth ignores provider errors and tries next. |
| `server/composite-auth.ts:157` | multi-provider authorize | `auth.composite_authorized`, `auth.composite_authorization_rejected` | Authorization succeeds when any provider allows. |
| `server/composite-auth.ts:193` | SSO callback | `auth.sso_callback_started`, `auth.sso_callback_completed`, `auth.sso_callback_failed` | External SSO callback boundary. |
| `server/composite-auth.ts:224` | session create | `auth.session_created`, `auth.session_create_failed` | Delegates to first session-capable provider. |
| `server/composite-auth.ts:230` | session validate | `auth.session_validated`, `auth.session_invalid` | Session lookup and validation. |
| `server/composite-auth.ts:245` | session destroy across providers | `auth.session_destroyed`, `auth.session_destroy_failed_ignored` | Destroy errors are ignored provider-by-provider. |
| `server/composite-auth.ts:319` | current user across providers | `auth.current_user_resolved`, `auth.current_user_failed_ignored`, `auth.current_user_missing` | Similar fallback behavior to token auth. |
| `server/types.ts` | request logging config | `http_request.logged`, `http_request.log_skipped` | Server supports request logging but Pulse could represent request lifecycle consistently. |
| `server/types.ts` | validation error handler | `http_request.validation_failed` | Zod validation errors can be customized. |
| `server/types.ts` | custom error handler | `http_request.unhandled_error` | Server-level error formatting/logging boundary. |
| `license/index.ts:87` | `fetchWithRetry(...)` | `license.request_attempted`, `license.request_retry_scheduled`, `license.request_failed` | License validation retries transient failures. |
| `license/index.ts:117` | cached validation | `license.cache_hit`, `license.cache_miss` | Validation can return from cache. |
| `license/index.ts:146` | `performValidation(...)` | `license.validation_started`, `license.validation_succeeded`, `license.validation_failed`, `license.validation_rate_limited` | External license server decision. |
| `license/index.ts:151` | non-HTTPS warning | `license.insecure_url_warning` | Security warning. |
| `license/index.ts:197` | unreachable server/grace/fail-open handling | `license.server_unreachable`, `license.grace_used`, `license.grace_expired`, `license.fail_open` | Availability and entitlement decisions. |
| `license/index.ts:237` | background revalidation | `license.background_revalidation_started`, `license.background_revalidation_failed` | Timer-driven validation outside request flow. |
| `license/index.ts:260` | `hasFeature(...)` | `license.feature_checked`, `license.feature_allowed`, `license.feature_denied` | Feature entitlement decision. |
| `cache/inmemory.ts:39` | cache get/set/delete | `cache.get`, `cache.set`, `cache.delete`, `cache.clear` | Server cache supports stream replay and other runtime state. |
| `cache/inmemory.ts:53` | list length/push/read | `cache.list_read`, `cache.list_pushed`, `cache.list_type_error` | List operations can throw when existing value has wrong type. |
| `cache/inmemory.ts:97` | increment | `cache.incremented`, `cache.increment_type_error` | Counter operation can fail on wrong existing type. |
| `bundler/index.ts:10` | bundle operation | `bundler.started`, `bundler.completed`, `bundler.failed` | Build/deploy packaging boundary. |
| `bundler/index.ts:25` | env var load | `bundler.env_loaded`, `bundler.env_load_failed` | Environment variables affect generated bundle. |
| `deployer/index.ts:13` | deploy operation | `deployer.started`, `deployer.completed`, `deployer.failed` | Deployment is an external side-effect boundary. |
| `hooks/index.ts:15` | hook registration | `hook.registered` | Runtime callback registered. |
| `hooks/index.ts:20` | hook execution | `hook.executed`, `hook.execution_failed` | Hook emitter catches errors by behavior of handlers? Worth making explicit. |
| `features/index.ts` | core feature flags | `core_feature.checked` | Compatibility checks can explain availability of recent features. |
| `editor/types.ts` | editor namespace operations | `editor.operation_started`, `editor.operation_failed` | Type surface exposes storage/provider/builder management operations that need implementation-level pulses where backed. |

Notes:

- Server/auth/license/cache are mostly infrastructure-level Pulse candidates rather than agent execution observations.
- Candidate data: retry attempt, cache list length, route count, status code, validation issue count.
- Candidate attributes: route path/method, auth provider id/type, session id, feature name, license plan tier, cache key namespace.
