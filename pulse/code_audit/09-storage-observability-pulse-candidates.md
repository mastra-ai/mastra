# Storage and Observability Pulse Candidate Audit

Scope: `packages/core/src`.

This file continues the Pulse candidate audit with two related areas:

- the current observability context/span/log/metric storage path
- storage composition/domains that recent features rely on but that do not generally emit runtime observations today

Working heuristic: capture persistence boundaries, store selection, feature support decisions, fallback behavior, and lossy record-building conversions.

## `observability`

Files inspected:

- `packages/core/src/observability/context.ts`
- `packages/core/src/observability/context-factory.ts`
- `packages/core/src/observability/context-storage.ts`
- `packages/core/src/observability/rag-ingestion.ts`
- `packages/core/src/observability/utils.ts`
- `packages/core/src/observability/no-op.ts`
- `packages/core/src/observability/types/*`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `observability/context.ts:37` | `wrapMastra(...)` no-op checks | `observability.wrap_skipped_no_span`, `observability.wrap_skipped_noop_span`, `observability.wrap_skipped_non_mastra` | Tracing context propagation silently does nothing in expected branches. |
| `observability/context.ts:56` | Mastra proxy creation | `observability.mastra_wrapped`, `observability.mastra_wrap_failed` | Proxy creation failures currently use `console.warn` and fall back. |
| `observability/context.ts:64` | agent getter wrapping | `observability.agent_getter_wrapped`, `observability.agent_method_wrap_failed` | Agent method injection can fail per property access. |
| `observability/context.ts:108` | agent generate/stream proxy | `observability.agent_call_context_injected` | Adds tracing context into `generate`, `stream`, and legacy methods. |
| `observability/context.ts:142` | workflow proxy | `observability.workflow_wrapped`, `observability.workflow_wrap_failed` | Workflow wrapping has separate failure/fallback behavior. |
| `observability/context.ts:155` | workflow `createRun` proxy | `observability.workflow_run_wrapped` | Run objects get a later `start` wrapper, which affects parent/child relationships. |
| `observability/context.ts:197` | run `start` proxy | `observability.workflow_run_start_context_injected` | Injects tracing context at run start. |
| `observability/context-factory.ts:12` | logger derivation | `observability.logger_context_resolved`, `observability.logger_context_noop` | Logger context may be derived from active span or no-op. |
| `observability/context-factory.ts:21` | metrics derivation | `observability.metrics_context_resolved`, `observability.metrics_context_noop` | Metrics context may be derived from active span or no-op. |
| `observability/context-factory.ts:40` | create full context | `observability.context_created` | Single object carries tracing, logger, metrics, and alias. |
| `observability/context-factory.ts:60` | resolve partial context | `observability.context_resolved`, `observability.context_partial_defaults_applied` | Missing pieces are filled from tracing/no-op defaults. |
| `observability/context-storage.ts:58` | async context execution | `observability.async_context_entered`, `observability.async_context_fallback` | AsyncLocalStorage + optional span-specific context execution. |
| `observability/context-storage.ts:90` | sync context execution | `observability.sync_context_entered`, `observability.sync_context_fallback` | Same decision for sync execution. |
| `observability/rag-ingestion.ts:89` | `startRagIngestion(...)` | `rag_ingestion.span_started`, `rag_ingestion.context_created` | Starts traditional `RAG_INGESTION` root span and observability context. |
| `observability/rag-ingestion.ts:121` | scoped ingestion helper | `rag_ingestion.started`, `rag_ingestion.completed`, `rag_ingestion.failed` | Wraps a user callback and records output/error. |
| `observability/utils.ts:16` | current span resolver registration | `observability.current_span_resolver_registered` | Browser-safe resolver indirection controls context lookup. |
| `observability/utils.ts:29` | signal id generation | `observability.signal_id_generated` | Current log/metric/score/feedback ids are generated here. |
| `observability/utils.ts:41` | step tool availability | `model_inference.available_tools_resolved` | Computes active tool names for model inference attributes. |
| `observability/utils.ts:93` | `executeWithContext(...)` fallback | `observability.execute_with_context_fallback` | Falls back when context-storage implementation is not registered. |
| `observability/utils.ts:125` | child-vs-root span creation | `observability.span_child_created`, `observability.span_root_created`, `observability.span_creation_skipped` | Central traditional span creation decision. |
| `observability/utils.ts:157` | root export span resolution | `observability.root_export_span_resolved` | Internal spans are skipped when finding external trace/span correlation. |
| `observability/utils.ts:181` | entity type inference | `observability.entity_type_inferred`, `observability.entity_type_unknown` | Maps span types to entity types for storage/query. |
| `observability/no-op.ts` | no-op contexts | `observability.noop_trace_used`, `observability.noop_log_dropped`, `observability.noop_metric_dropped` | Useful when diagnosing missing observability output. |

Notes:

- This area contains the traditional observability vocabulary directly. Pulse may replace most span/log/metric naming, but these fallback/derivation decisions remain relevant.
- Candidate data: wrapped method count, active tool count.
- Candidate attributes: span type, entity type, method name, wrapper target type.

## Storage Composition and Initialization

Files inspected:

- `packages/core/src/storage/base.ts`
- `packages/core/src/storage/storageWithInit.ts`
- `packages/core/src/storage/domains/base.ts`
- `packages/core/src/storage/filesystem-db.ts`
- `packages/core/src/storage/git-history.ts`
- `packages/core/src/storage/filesystem-versioned.ts`
- `packages/core/src/storage/source-control.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `storage/base.ts:248` | composite store constructor | `storage.composite_created`, `storage.composite_config_invalid` | Store composition can fail before runtime starts. |
| `storage/base.ts:265` | source validation | `storage.composite_source_validated`, `storage.composite_source_missing` | Requires at least one default/editor/domain source. |
| `storage/base.ts:276` | domain resolution priority | `storage.domain_resolved`, `storage.domain_missing` | Domains resolve in `domains > editor > default` order. |
| `storage/base.ts:313` | default in-memory thread-state | `storage.thread_state_defaulted_inmemory` | Built-in task tools get an implicit non-durable store unless overridden. |
| `storage/base.ts:328` | `__registerMastra(...)` cascade | `storage.mastra_registered`, `storage.mastra_registration_cascaded` | Storage/domain instances receive Mastra references, with cycle protection. |
| `storage/base.ts:361` | `getStore(...)` | `storage.domain_requested`, `storage.domain_returned`, `storage.domain_unavailable` | Domain access is the main persistence lookup boundary. |
| `storage/base.ts:383` | `init()` coalescing | `storage.init_started`, `storage.init_reused`, `storage.init_completed`, `storage.init_failed` | Initialization is cached and shared across calls. |
| `storage/base.ts:394` | parent store init delegation | `storage.parent_init_started`, `storage.parent_init_completed` | Parent store init owns adapter-level setup and migration ordering. |
| `storage/base.ts:410` | per-domain init | `storage.domain_init_started`, `storage.domain_init_completed`, `storage.domain_init_skipped_duplicate`, `storage.domain_init_failed` | Domains not covered by parents initialize individually. |
| `storage/storageWithInit.ts:20` | init rejection clears cache | `storage.init_failed_retry_enabled` | A failed init resets cached promise and logs an error. |
| `storage/storageWithInit.ts:34` | auto-init skip by config/env | `storage.auto_init_skipped_disabled`, `storage.auto_init_skipped_env` | Runtime storage calls may intentionally avoid init. |
| `storage/storageWithInit.ts:63` | proxy-wrapped methods | `storage.auto_init_before_call`, `storage.call_after_init` | Every method except `init` waits for initialization. |
| `storage/domains/base.ts:9` | domain init default no-op | `storage_domain.init_noop` | Some domains deliberately do no setup. |
| `storage/domains/base.ts:17` | destructive clear | `storage_domain.clear_all_started`, `storage_domain.clear_all_completed` | Destructive/testing hook should be visible if ever called outside tests. |
| `storage/filesystem-db.ts:28` | filesystem DB init | `filesystem_storage.initialized`, `filesystem_storage.init_skipped_cached` | Creates base and skills dirs once. |
| `storage/filesystem-db.ts:51` | read domain JSON | `filesystem_storage.domain_read`, `filesystem_storage.domain_cache_hit`, `filesystem_storage.domain_corrupt_reset` | Corrupt JSON is swallowed and treated as empty data. |
| `storage/filesystem-db.ts:76` | atomic domain write | `filesystem_storage.domain_written` | Writes `.tmp` then renames. |
| `storage/filesystem-db.ts:99` | list files with path guard | `filesystem_storage.path_guard_failed`, `filesystem_storage.domain_files_listed` | Path traversal/configured-file errors throw. |
| `storage/filesystem-db.ts:127` | remove domain file | `filesystem_storage.domain_file_removed`, `filesystem_storage.domain_file_missing` | Deletes on-disk domain data. |
| `storage/filesystem-db.ts:140` | cache invalidation | `filesystem_storage.cache_invalidated` | Forces future disk reads. |
| `storage/filesystem-db.ts:201` | skill path guards | `filesystem_storage.skill_path_guard_failed` | Skill file operations guard against escaping storage dir. |
| `storage/git-history.ts:37` | git repo detection | `git_history.repo_detected`, `git_history.repo_missing` | Source-history features silently degrade outside Git repos. |
| `storage/git-history.ts:63` | file history lookup | `git_history.file_history_loaded`, `git_history.file_history_empty`, `git_history.file_history_failed` | Git errors return empty lists. |
| `storage/git-history.ts:121` | snapshot at commit | `git_history.snapshot_loaded`, `git_history.snapshot_missing`, `git_history.snapshot_parse_failed` | Historic JSON can be absent or invalid. |
| `storage/git-history.ts:143` | cache invalidation | `git_history.cache_invalidated` | External Git changes require cache reset. |

Notes:

- Storage init failures are already logged in one wrapper, but domain/source selection and auto-init skip decisions are otherwise invisible.
- Candidate data: domain count, initialized domain count, git commit count, JSON entity count.
- Candidate attributes: storage id, domain name, adapter name, source kind, file name.

## Observability Storage Contract

Files inspected:

- `packages/core/src/storage/domains/observability/base.ts`
- `packages/core/src/storage/domains/observability/inmemory.ts`
- `packages/core/src/storage/domains/observability/record-builders.ts`
- `packages/core/src/storage/domains/observability/{tracing,logs,metrics,scores,feedback,discovery}.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `storage/domains/observability/base.ts:83` | strategy hints | `observability_storage.strategy_reported` | Exporters choose storage write strategy from this contract. |
| `storage/domains/observability/base.ts:112` | runtime strategy | `observability_storage.runtime_strategy_reported`, `observability_storage.runtime_strategy_unknown` | Multi-strategy stores may not report a runtime strategy. |
| `storage/domains/observability/base.ts:122` | optional features | `observability_storage.features_reported`, `observability_storage.features_missing` | Delta polling support is opt-in. |
| `storage/domains/observability/base.ts:129` | `createSpan` default | `observability_storage.span_create_unsupported` | Default methods throw typed `MastraError`s. |
| `storage/domains/observability/base.ts:140` | `updateSpan` default | `observability_storage.span_update_unsupported` | Span update support differs by backend/strategy. |
| `storage/domains/observability/base.ts:152` | span/trace getters default | `observability_storage.trace_query_unsupported` | Missing query support is currently an exception. |
| `storage/domains/observability/base.ts:201` | `getStructure(...)` legacy fallback | `observability_storage.structure_get_started`, `observability_storage.structure_fallback_to_light`, `observability_storage.structure_unsupported` | Canonical and legacy lightweight trace APIs delegate to each other. |
| `storage/domains/observability/base.ts:226` | `getTraceLight(...)` legacy fallback | `observability_storage.trace_light_fallback_to_structure` | Legacy callers can hit canonical implementation. |
| `storage/domains/observability/base.ts:250` | `getBranch(...)` optimized path | `observability_storage.branch_get_started`, `observability_storage.branch_get_optimized`, `observability_storage.branch_get_fallback_full_trace`, `observability_storage.branch_get_missing` | Fetches skeleton + selected spans when supported, else full trace. |
| `storage/domains/observability/base.ts:298` | batch span APIs | `observability_storage.spans_batched`, `observability_storage.spans_batch_update_unsupported` | Batch create/update are strategy-sensitive. |
| `storage/domains/observability/base.ts:321` | trace deletion | `observability_storage.traces_deleted`, `observability_storage.traces_delete_unsupported` | Delete traces removes associated spans. |
| `storage/domains/observability/base.ts:336` | log APIs | `observability_storage.logs_created`, `observability_storage.logs_listed`, `observability_storage.logs_unsupported` | Current traditional log storage surface. |
| `storage/domains/observability/base.ts:357` | metric APIs | `observability_storage.metrics_created`, `observability_storage.metrics_listed`, `observability_storage.metrics_aggregated`, `observability_storage.metrics_unsupported` | Current traditional metric storage surface and analytics. |
| `storage/domains/observability/base.ts:397` | metric discovery | `observability_storage.metric_names_listed`, `observability_storage.metric_labels_listed` | UI/filter discovery over stored metrics. |
| `storage/domains/observability/base.ts:427` | entity discovery | `observability_storage.entities_discovered`, `observability_storage.tags_discovered` | Cross-signal discovery over entity/service/env/tag fields. |
| `storage/domains/observability/base.ts:470` | score APIs | `observability_storage.scores_created`, `observability_storage.scores_listed`, `observability_storage.scores_aggregated` | Score observations are separate from eval dataset stores. |
| `storage/domains/observability/base.ts:601` | feedback APIs | `observability_storage.feedback_created`, `observability_storage.feedback_listed`, `observability_storage.feedback_aggregated` | Feedback is another traditional signal surface. |
| `storage/domains/observability/inmemory.ts:441` | span insertion | `observability_inmemory.span_created`, `observability_inmemory.span_upserted` | In-memory implementation upserts into trace maps. |
| `storage/domains/observability/inmemory.ts:542` | span/trace reads | `observability_inmemory.trace_read`, `observability_inmemory.trace_missing` | Query behavior and sorting affect UI outputs. |
| `storage/domains/observability/inmemory.ts:694` | trace listing | `observability_inmemory.traces_listed` | Applies filters, grouping, pagination. |
| `storage/domains/observability/inmemory.ts:911` | branch listing | `observability_inmemory.branches_listed` | Branch view is newer than trace view and important for nested executions. |
| `storage/domains/observability/inmemory.ts:1079` | span updates | `observability_inmemory.span_updated`, `observability_inmemory.span_update_missing` | Realtime strategy can update existing records. |
| `storage/domains/observability/inmemory.ts:1126` | delete traces | `observability_inmemory.traces_deleted` | Deletes trace map entries. |
| `storage/domains/observability/inmemory.ts:1143` | metric writes/list/aggregates | `observability_inmemory.metrics_created`, `observability_inmemory.metrics_queried`, `observability_inmemory.metrics_aggregated` | In-memory analytics cover aggregate/breakdown/timeseries/percentiles. |
| `storage/domains/observability/inmemory.ts:1704` | log writes/list | `observability_inmemory.logs_created`, `observability_inmemory.logs_queried` | Logs are stored and filtered by trace/span/entity/request fields. |
| `storage/domains/observability/inmemory.ts:1817` | score writes/list/aggregates | `observability_inmemory.scores_created`, `observability_inmemory.scores_queried`, `observability_inmemory.scores_aggregated` | Scores have their own aggregation path. |
| `storage/domains/observability/inmemory.ts:2164` | feedback writes/list/aggregates | `observability_inmemory.feedback_created`, `observability_inmemory.feedback_queried`, `observability_inmemory.feedback_aggregated` | Feedback supports numeric aggregation and breakdowns. |
| `storage/domains/observability/record-builders.ts:47` | span attributes serialization | `observability_record.span_attributes_serialized`, `observability_record.span_attributes_dropped` | Non-serializable attributes are silently dropped to null. |
| `storage/domains/observability/record-builders.ts:139` | span record builder | `observability_record.span_built` | Extracts identity, correlation, metadata, input/output/error fields. |
| `storage/domains/observability/record-builders.ts:202` | metric record builder | `observability_record.metric_built`, `observability_record.metric_legacy_labels_stripped` | Pulls correlation from context and legacy labels; strips legacy labels. |
| `storage/domains/observability/record-builders.ts:265` | log record builder | `observability_record.log_built`, `observability_record.log_legacy_metadata_used` | Pulls correlation from context and legacy metadata. |
| `storage/domains/observability/record-builders.ts:292` | score record builder | `observability_record.score_built` | Normalizes source fields and correlation. |
| `storage/domains/observability/record-builders.ts:319` | feedback record builder | `observability_record.feedback_built` | Normalizes feedback source/user/correlation. |

Notes:

- This is the clearest place where Pulse could consolidate current span/log/metric/score/feedback storage into one storage contract.
- Duration should continue to be derived from paired observations/timestamps rather than captured as a Pulse `data` item.
- Candidate data: records written, records returned, aggregation bucket count, percentile count.
- Candidate attributes: trace id, span id, entity type/name, request id, metric name, score id, feedback type, storage strategy.

## Other Storage Domains

Files inspected by method surface:

- `packages/core/src/storage/domains/agents/*`
- `packages/core/src/storage/domains/background-tasks/*`
- `packages/core/src/storage/domains/blobs/*`
- `packages/core/src/storage/domains/channels/*`
- `packages/core/src/storage/domains/datasets/*`
- `packages/core/src/storage/domains/experiments/*`
- `packages/core/src/storage/domains/favorites/*`
- `packages/core/src/storage/domains/harness/*`
- `packages/core/src/storage/domains/mcp-{clients,servers}/*`
- `packages/core/src/storage/domains/memory/*`
- `packages/core/src/storage/domains/notifications/*`
- `packages/core/src/storage/domains/operations/*`
- `packages/core/src/storage/domains/prompt-blocks/*`
- `packages/core/src/storage/domains/schedules/*`
- `packages/core/src/storage/domains/scorer-definitions/*`
- `packages/core/src/storage/domains/scores/*`
- `packages/core/src/storage/domains/skills/*`
- `packages/core/src/storage/domains/thread-state/*`
- `packages/core/src/storage/domains/tool-provider-connections/*`
- `packages/core/src/storage/domains/workflows/*`
- `packages/core/src/storage/domains/workspaces/*`

| Domain | Candidate Pulse | Why |
| --- | --- | --- |
| `agents`, `workspaces`, `skills`, `promptBlocks`, `scorerDefinitions`, `mcpClients`, `mcpServers` | `editor_entity.created`, `editor_entity.updated`, `editor_entity.deleted`, `editor_entity.listed`, `editor_entity.version_created`, `editor_entity.version_deleted` | Versioned editor domains are important user-visible persistence surfaces. |
| `agents/source.ts` | `source_control.ref_used`, `source_control.snapshot_loaded`, `source_control.snapshot_parse_failed` | Source-backed agents read from provider refs/history. |
| `background-tasks` | `background_task.storage_created`, `background_task.storage_updated`, `background_task.storage_listed`, `background_task.storage_deleted`, `background_task.running_count_read` | Complements runtime background-task manager/workflow pulses. |
| `blobs` | `blob.stored`, `blob.loaded`, `blob.missing`, `blob.deleted`, `blob.batch_stored`, `blob.batch_loaded` | Blob store backs opaque binary/content-addressed data. |
| `channels` | `channel.installation_saved`, `channel.installation_loaded`, `channel.installation_deleted`, `channel.config_saved`, `channel.config_deleted` | Channel integrations need persistence visibility separate from stream consumption. |
| `datasets`, `experiments` | `dataset_record.*`, `experiment_record.*`, `experiment_result.*` | Storage-domain counterpart to higher-level dataset/experiment manager pulses in `07`. |
| `favorites` | `favorite.added`, `favorite.removed`, `favorite.checked`, `favorite.batch_checked`, `favorite.entity_deleted` | User personalization state. |
| `harness` | `harness_session.created`, `harness_session.updated`, `harness_session.loaded`, `harness_session.deleted` | User specifically called out Harness; storage currently holds the durable side. |
| `memory` | `memory_thread.saved`, `memory_thread.loaded`, `memory_messages.saved`, `memory_messages.loaded`, `memory_working_memory.saved` | Storage-domain counterpart to higher-level memory pulses in `07`. |
| `notifications` | `notification.created`, `notification.read`, `notification.dismissed`, `notification.listed` | Notification delivery/state likely lacks traditional observability. |
| `operations` | `operation.created`, `operation.updated`, `operation.completed`, `operation.failed` | Long-running operations should be tied into Pulse once mapped. |
| `schedules` | `schedule.created`, `schedule.updated`, `schedule.deleted`, `schedule.due_listed`, `schedule.trigger_recorded` | Scheduling decisions and triggers are temporal by nature. |
| `scores` | `score.saved`, `score.loaded`, `score.listed` | Separate score domain predates/overlaps observability score records. |
| `thread-state` | `thread_state.read`, `thread_state.set`, `thread_state.deleted` | Task/goals/state-signals depend on this domain. |
| `tool-provider-connections` | `tool_provider_connection.upserted`, `tool_provider_connection.loaded`, `tool_provider_connection.listed`, `tool_provider_connection.deleted` | Provider tool runtime resolution depends on stored connections. |
| `workflows` | `workflow_snapshot.persisted`, `workflow_snapshot.loaded`, `workflow_state.updated`, `workflow_results.updated`, `workflow_runs_listed`, `workflow_run_deleted` | Durable workflow execution and resume depend on these state transitions. |

Notes:

- This section is a method-surface audit rather than a full behavioral audit of every domain implementation.
- Several of these domains are already covered at higher levels in earlier audit files; storage-domain pulses would need dedupe rules so a high-level operation and its storage write do not repeat the same data.
