# Langfuse to Mastra Platform trace migration (CLI-only)

Status: implemented and technically verified in the two feature worktrees; awaiting external confirmation that V0 is traces-only
Scope: Langfuse API -> Mastra CLI -> existing Mastra Platform observability ingestion
Out of scope for this version: Studio upload, local/S3/file readers, OTLP files, other providers, database connectors, logs, metrics, scores, feedback, prompt-entity/content migration, and a long-running server-side import job

## 1. Recommended outcome

Add a resumable command:

```text
mastra traces import --provider langfuse
```

The command reads the last 30 days of completed Langfuse traces through the supported Langfuse Observations API v2, validates and normalizes them into Mastra spans, and sends bounded batches to the existing project-scoped MOBS collector endpoint. It preserves the source `startTime` and `endTime`; ingestion time is never substituted for either timestamp.

For V0, use the existing Platform organization API-key contract:

```text
POST {collectorOrigin}/projects/{projectId}/ai/spans/publish
Authorization: Bearer <WorkOS organization API key (sk_*)>
x-mastra-observability-capabilities: quota-pause-v1
Content-Type: application/json

{ "spans": [...] }
```

This reuses the same public boundary as `MastraPlatformExporter`, keeps provider-specific code in OSS, and keeps organization/project authorization and all ClickHouse details private to Platform. It does not introduce a second ingestion path.

After acknowledgement, the CLI verifies a deterministic sample through the existing public read boundary:

```text
GET {collectorOrigin}/api/observability/traces/{traceId}/light
Authorization: Bearer <the same organization API key>
X-Mastra-Project-Id: <projectId>
```

The response must contain every expected deterministic span ID for a sampled trace. The CLI never connects to ClickHouse directly.

Important: the normal token stored by `mastra auth login` is not accepted by this project-scoped collector route. For V0 the command must require `MASTRA_PLATFORM_ACCESS_TOKEN` to be an organization API key and must not silently fall back to the stored CLI login token. If the product requirement is login-token-only UX, complete the optional token-exchange prerequisite in section 11 before implementing the command.

### V0 in one page

The user supplies two sets of credentials because the CLI talks to two systems:

```text
Langfuse credentials                         Mastra Platform credentials
public key + secret key + base URL           organization key + project ID + collector URL
            |                                                |
            +-------------------- CLI ------------------------+
```

The runtime pipeline is:

```text
1. User runs
   mastra traces import --provider langfuse
          |
2. CLI asks Langfuse API for observations from the last 30 days
          |
3. CLI saves pages temporarily so interruption can resume
          |
4. CLI groups observations by trace and validates each tree
          |
5. CLI converts each valid Langfuse observation into a Mastra span
   - stable Mastra trace/span IDs
   - original Langfuse IDs retained in metadata
   - original start/end timestamps retained exactly
          |
6. CLI sends small batches to the existing project-scoped collector route
          |
7. Existing Platform pipeline validates tenant + payload
          |
8. Existing Pub/Sub and ClickHouse writer store the spans
          |
9. CLI polls the existing light trace query and verifies exact span IDs
          |
10. Imported traces appear in the same trace queries/views as live traces
```

No Studio, S3, UI-upload, Parquet/CSV reader, other provider, score migration, or new Platform ingestion service is part of V0.

### What changes in each repository

```text
OSS Mastra (the feature)
├── new trace-import package
│   ├── Langfuse API reader
│   ├── trace validator + mapper
│   ├── checkpoint/resume manifest
│   ├── Platform batch uploader
│   └── post-upload query verifier
├── new `mastra traces import` command
├── unit/integration tests
└── user documentation + changeset

Private Platform (contract protection, no new V0 pipeline)
├── collector contract fixture/test for an imported span
├── timestamp + tenant attribution regression tests
├── organization-key query regression test
└── dedupe/TTL regression coverage where it is missing
```

Platform already has the collector, Pub/Sub writer, ClickHouse tables, trace query APIs, quota handling, and project authorization. V0 reuses them. The Platform PR can therefore be test-only contract protection; if maintainers do not want a test-only PR, no Platform runtime deployment is required before the OSS feature.

### One example

Langfuse returns this observation:

```json
{
  "id": "lf-observation-7",
  "traceId": "lf-trace-2",
  "parentObservationId": null,
  "type": "GENERATION",
  "name": "answer-question",
  "startTime": "2026-08-20T10:00:00.000Z",
  "endTime": "2026-08-20T10:00:02.000Z",
  "model": "gpt-4o-mini",
  "input": "{\"question\":\"Hello?\"}",
  "output": "{\"answer\":\"Hi!\"}"
}
```

The CLI produces this collector span (IDs abbreviated here only for readability):

```json
{
  "traceId": "<stable 32-hex hash of Langfuse project + lf-trace-2>",
  "spanId": "<stable 16-hex hash of Langfuse project + lf-observation-7>",
  "parentSpanId": null,
  "spanType": "model_generation",
  "name": "answer-question",
  "startedAt": "2026-08-20T10:00:00.000Z",
  "endedAt": "2026-08-20T10:00:02.000Z",
  "isEvent": false,
  "input": { "question": "Hello?" },
  "output": { "answer": "Hi!" },
  "attributes": { "model": "gpt-4o-mini" },
  "metadata": {
    "source": "langfuse",
    "langfuseTraceId": "lf-trace-2",
    "langfuseObservationId": "lf-observation-7",
    "importBatchId": "<resume-safe import ID>"
  }
}
```

If this trace originally ended 14 days ago, it has about 16 days of Platform retention left. If it ended 29 days ago, it has about one day left. The import never changes the date to today.

## 2. Worktrees prepared for the implementation

| Repository | Worktree                                                            | Branch                                 | Starting point                 |
| ---------- | ------------------------------------------------------------------- | -------------------------------------- | ------------------------------ |
| OSS Mastra | `/Users/anuragojha/.t3/worktrees/mastra/t3code-769678b1`            | `t3code/plan-langfuse-trace-migration` | Existing task worktree         |
| Platform   | `/Users/anuragojha/.t3/worktrees/platform/langfuse-trace-migration` | `t3code/plan-langfuse-trace-migration` | Platform `main` at `6e04a74e4` |

The only change made during this planning phase is this file in the OSS worktree.

## 3. What exists today

### OSS Mastra

- `packages/cli/src/index.ts` owns top-level commands. `mastra api trace ...` is read-only and is generated around query routes; the import command should be a separate `mastra traces import` workflow rather than another generic `mastra api` leaf.
- `packages/cli/src/commands/auth/credentials.ts` returns either `MASTRA_API_TOKEN` or the refreshable user login token. Neither is automatically an organization ingestion key.
- `packages/cli/src/commands/init/observability-provision.ts` already demonstrates the supported write setup: select/create a Platform project, mint a WorkOS organization key, and write `MASTRA_PLATFORM_ACCESS_TOKEN` plus `MASTRA_PROJECT_ID`.
- `observability/mastra/src/exporters/mastra-platform.ts` already serializes live `ExportedSpan` objects to `{ spans: [...] }`, defaults to 1,000 records per batch, uses the project-scoped endpoint when a project ID is present, and advertises `quota-pause-v1`.
- The live exporter is not a migration engine. It drops unsupported model chunks, retries in memory, pauses/drops on auth or quota conditions, and has no durable checkpoint. The import command must not instantiate it as its uploader.
- `packages/core/src/observability/types/tracing.ts` is the canonical Mastra span/type definition. It expects OTel-shaped 32-hex trace IDs and 16-hex span IDs at the OSS API level, even though the hosted collector currently accepts arbitrary strings.
- `@mastra/langfuse` is an outbound exporter from Mastra to Langfuse. An inbound Langfuse importer must not be added to that package because the direction and lifecycle are different.

### Private Platform

- `servers/mobs-collector/src/routes/ai.ts` has two existing span write routes:
  - `/ai/spans/publish`: Platform-signed JWT containing `teamId` and `projectId`.
  - `/projects/:projectId/ai/spans/publish`: WorkOS organization API key, verified through `/v1/auth/ingest/verify`, with project ownership checked server-side.
- `servers/mobs-collector/src/lib/ai-signals.ts` validates every span in a batch. A bad record rejects the entire HTTP batch. Tenant scope comes from authentication, not the body.
- `servers/mobs-collector/src/lib/pubsub.ts` acknowledges after Pub/Sub accepts all messages. A 200 response is an enqueue acknowledgement, not proof that ClickHouse has committed the rows.
- `servers/mobs-ch-writer/src/observability-v-next/index.ts` builds `dedupeKey = traceId + ':' + spanId`, preserves `startedAt`/`endedAt`, and truncates JSON-bearing fields at 1 MiB. It also limits arrays to 1,000 elements, nesting to 100 levels, and field names to 200 bytes.
- `servers/mobs-ch-writer/sql/mastra-observability-v-next.sql` uses `ReplacingMergeTree`, partitions by `endedAt`, and applies `TTL endedAt + 30 days` to span, root, and branch tables. The trace-root materialized view only receives spans whose physical `parentSpanId` is null.
- `servers/mobs-query/src/services/observability.ts` maps stored `startedAt` back to the API's `createdAt`. A correctly migrated trace therefore displays its source time, not import time.

### Langfuse

- The supported read surface is `GET /api/public/v2/observations`. It returns observation rows, not trace objects, is ordered by `startTime` descending, supports a maximum page size of 1,000, and uses cursor pagination.
- Every request should set both `fromStartTime` and `toStartTime`. V2 input/output values are raw strings; the importer must attempt JSON parsing and retain the original string when parsing fails.
- V2 is available on Langfuse Cloud and self-hosted Langfuse v4+. Self-hosted v3 requires the deprecated V1 endpoint, and Langfuse Cloud currently schedules the deprecated read endpoints to stop on November 16, 2026. V0 should support V2 only and fail with a specific compatibility message for a V3 installation rather than starting new work on a soon-to-be-removed schema.
- Observations produced by older Langfuse SDKs/direct OTel exporters can take up to 15 minutes to become visible through V2. The completion report should warn about this consistency window and recommend an overlap/re-run for a source that was still receiving traffic during migration.
- Langfuse credentials are a project public/secret key pair using Basic Auth. The base URL is region-specific and must also support an arbitrary self-hosted origin.
- Current observation types are `EVENT`, `SPAN`, `GENERATION`, `AGENT`, `TOOL`, `CHAIN`, `RETRIEVER`, `EVALUATOR`, `EMBEDDING`, and `GUARDRAIL`; the three-type model in the draft diagram is out of date.
- Observations API V2 uses the general API rate-limit bucket. On HTTP 429, `Retry-After` is authoritative.

## 4. Corrections to the proposed diagrams

| Diagram claim                                                             | Finding and correction                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic `Authorization: Bearer <access token>` can call the project route | Too broad. The existing project route accepts a WorkOS organization API key (`sk_*`), not the ordinary CLI user token. The JWT route accepts only a Platform-signed project JWT.                                                                     |
| Project, organization, and environment all come from the JWT              | Only true on `/ai/spans/publish`. With the proposed V0 API-key route, organization comes from the key, project comes from the URL after ownership validation, and environment comes from `span.metadata.environment`.                                |
| `<= 1000` is a collector limit                                            | False. The collector currently has no record-count or request-byte limit in code. `1,000` is the live exporter's default and Langfuse V2's maximum page size, not a Platform contract. Import batches need their own tested count and byte ceilings. |
| ClickHouse is insert-only with exact dedupe                               | Incomplete. It is a `ReplacingMergeTree`; duplicates can exist until merges, and the read path collapses by `traceId:spanId`. Re-import is at-least-once/idempotent for identical payloads, not transactional exactly-once delivery.                 |
| All old spans should simply be skipped by a pre-validator                 | The 30-day cutoff must be defined at trace level or children can be imported without a root. V0 should only upload complete, structurally valid traces whose physical root is in the selected window.                                                |
| Imported traces receive the same 30 fresh days of retention               | Incorrect and undesirable. TTL is based on the original `endedAt`. A trace that ended 29 days ago has about one day remaining after import. This is how the source date is preserved.                                                                |
| Provider fields can all be converted to the Mastra type                   | Not losslessly. Several Langfuse observation types and score types have no exact Mastra equivalent. Preserve the source type/fields as provenance and use conservative Mastra classifications.                                                       |
| Existing `MastraPlatformExporter` can perform the upload                  | It can serialize the wire shape, but its live-telemetry drop/retry behavior is unsafe for a migration. Reuse its protocol conventions, not its buffering lifecycle.                                                                                  |
| Langfuse has only span/generation/event observations                      | Outdated. It currently has ten observation types.                                                                                                                                                                                                    |
| Scores and feedback can be copied along with traces                       | Not as a lossless V0. Langfuse V3 scores can be numeric, boolean, categorical, text, or correction; the Platform score contract requires a number. Do not coerce or misclassify them.                                                                |

### Corrections to the supplied Notion notes

| Notion statement/example                                                         | Decision based on the current contracts                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “A trace is a record of its own”                                                 | This describes the legacy Langfuse model. In V4/V2 reads, observations are the records and trace context is repeated on them; a consumer groups them by `traceId`. Do not build a new importer around the deprecated trace endpoint/file join.                                                                                |
| API and blob export are merely camelCase/snake_case spellings of the same fields | They overlap, but are not interchangeable by casing alone. Blob timestamps use UTC SQL-style text, blob exports include a `tools` field group, Parquet omits per-unit price fields, and older blob layouts have separate legacy trace/observation files. Each input format needs its own schema adapter.                      |
| V2 API example uses parsed object `input`/`output`                               | Current V2 does expose the provided model as `model`, but its I/O fields are raw strings. Parse valid JSON opportunistically and keep non-JSON strings unchanged. `providedModelName` is a legacy/domain spelling, not the current V2 response key.                                                                           |
| “Extras we also migrate: scores”                                                 | Not in trace-only V0. Platform scores require `score: number`; Langfuse also has categorical, text, boolean, and correction values. Mapping strings to feedback or metadata would change their meaning. A lossless score migration requires a separately designed Platform contract/storage/query change.                     |
| Target example uses `POST /ai/spans/publish`                                     | That path requires a Platform-signed project JWT. API-key V0 must use `/projects/:projectId/ai/spans/publish`.                                                                                                                                                                                                                |
| Target example says `importSource: "langsmith"`                                  | Copy/paste error for this initiative; it must be `langfuse-api-v2`.                                                                                                                                                                                                                                                           |
| Target example includes `attributes.provider: "openai"`                          | Langfuse V2 does not expose a canonical provider field in the documented observation model. Only set a provider when a trustworthy source field exists; never infer it from a model-name string.                                                                                                                              |
| Scores/feedback use `/ai/scores/publish` and `/ai/feedback/publish`              | With an organization key the corresponding routes are project-scoped. More importantly, those signals are not part of this V0 for the type-compatibility reason above.                                                                                                                                                        |
| File Mode A can glob `*.jsonl`/Parquet                                           | A Langfuse blob export must be consumed from a completed `manifests/{timestamp}.json`, then from its exact `files[].key` entries; adjacent windows have inclusive boundaries and require ID dedupe. Glob/listing is not a completeness boundary.                                                                              |
| UI download and blob files are one file mode                                     | UI export is JSON/CSV. Scheduled blob export can be Parquet, CSV, JSON, or JSONL, has manifests, and is available only on certain hosted plans (plus self-hosted). They require separate readers and tests.                                                                                                                   |
| API Mode B needs one `--api-key` and should be built later                       | Langfuse requires a public key, secret key, and regional/self-hosted base URL. Secrets must come from environment/config, not a command-line flag. API V2 is available on every hosted plan, has a documented typed/cursor contract, and supports the required bounded 30-day read, so it is the safer first Langfuse source. |

### Why V0 remains API-first

The supplied Mode A/Mode B ordering should be reversed for the first implementation:

- Observations API V2 is available on every Langfuse hosted plan and self-hosted V4.
- Its pagination, field groups, time bounds, types, and rate-limit response are documented.
- It provides a single current enriched observation shape without requiring CSV inference, a Parquet runtime, S3 credentials, or legacy/enriched layout detection.
- UI exports and blob exports are distinct formats, while blob storage export is not available on all hosted plans.
- The CLI can still spool API pages to JSONL locally, so the normalizer and resume path remain file-backed and bounded.

File readers remain the next source mode after the API contract is proven. When added, implement Langfuse UI JSON/CSV and manifest-driven enriched blob JSON/JSONL/CSV/Parquet as separate adapters; do not create a generic “JSON-shaped Langfuse” parser.

## 5. Proposed architecture

```text
Langfuse Observations API V2
        |
        | bounded cursor reads; fixed 30-day snapshot
        v
Langfuse adapter (OSS)
        |
        | validates source rows and spools JSONL + manifest
        v
Trace assembler / normalizer (OSS)
        |
        | complete physical trees, stable IDs, original timestamps
        v
Mastra collector DTO validator + batcher (OSS)
        |
        | POST /projects/:projectId/ai/spans/publish
        v
Existing MOBS collector (Platform)
        |
        v
Existing Pub/Sub -> CH writer -> ClickHouse
        |
        v
Existing trace queries and Platform views
```

Ownership rule:

- Provider names, credentials, pagination, source schemas, and provider-specific mapping live in OSS adapters.
- Provider-independent tree validation, checkpointing, batching, and retry policy live in an OSS import core.
- CLI prompts, flags, credential resolution, and terminal/JSON output live in `packages/cli`.
- Platform sees only validated Mastra-shaped span batches. It continues to own authorization, tenant attribution, quota, Pub/Sub, truncation, storage, and retention.

### Package boundary

Create `observability/trace-import` as `@mastra/trace-import`, consumed only by `packages/cli` in V0:

```text
observability/trace-import/src/
  types.ts                    provider-independent contracts
  import-run.ts               state machine/orchestration
  manifest.ts                 atomic durable checkpoint
  trace-assembler.ts          physical-tree validation/topological order
  ids.ts                      deterministic target IDs
  target/
    collector-schema.ts       public wire DTO and validation
    collector-client.ts       bounded upload/retry policy
  providers/langfuse/
    schema.ts                 exact V2 response schemas
    client.ts                 Basic Auth, pagination, rate-limit handling
    adapter.ts                Langfuse row -> canonical span

packages/cli/src/commands/traces/
  index.ts                    command registration
  import.ts                   target/source config and presentation
```

This matches the future multi-provider shape without adding Studio code. Keep the package API minimal until a second consumer exists. Do not place Platform-private database/auth types in OSS.

## 6. Exact source read and staging algorithm

1. Resolve source configuration from `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL`. Never accept either secret as a CLI flag because flags leak into shell history/process listings.
2. Resolve a target project explicitly from `--project`, then `MASTRA_PROJECT_ID`, then `.mastra-project.json`. Never infer a target by name when more than one project could match.
3. Set one immutable `snapshotAt` at command start and `cutoffAt = snapshotAt - 30 * 24 hours`. Store both in the manifest.
4. Request V2 observations with:
   - `fromStartTime=cutoffAt`
   - `toStartTime=snapshotAt`
   - `limit=1000`
   - `fields=core,basic,time,io,metadata,model,usage,prompt,metrics,trace_context`
5. Persist every source page to a restricted-permission local JSONL spool before advancing the manifest cursor. Store no credentials in the manifest.
   Default the spool limit to 5,120 MiB and expose `--max-staging-mb` so an operator can choose a smaller safety bound or explicitly provision more local disk.
6. Reconstruct traces by `traceId` using disk-backed hash shards, not an unbounded in-memory map. This allows a second pass to validate complete trees for large projects.
7. A V0 trace is eligible only when:
   - it has a nonempty `traceId`;
   - exactly one import root exists: either a physical root with no parent or a Langfuse `isRootObservation: true` application root whose physical parent is outside the exported trace;
   - every non-import-root parent is present;
   - observation IDs are unique and the parent graph is acyclic;
   - all duration observations have a valid `endTime >= startTime` and no observation completes after the fixed snapshot;
   - all timestamps parse and the root start is within `[cutoffAt, snapshotAt)`.
8. Skip an entire invalid trace rather than uploading a partial tree. Record a stable reason and count in the report. `--dry-run` performs the complete read/validation/mapping phase without target writes.
9. Topologically order each valid trace root-first, normalize it, validate the final collector DTO, and assemble batches bounded by both record count and serialized bytes.
10. Upload and checkpoint each acknowledged batch atomically. Treat the acknowledgement as “enqueued,” not “stored.”
11. Poll the existing project-scoped light trace query for a deterministic sample of at most 10 eligible traces. Mark a trace verified only when every expected deterministic span ID is present. Keep upload completion separate from `verified`, `partial`, `timed-out`, or `unavailable` query status.

The initial target batch should be 100 spans and at most 4 MiB serialized, with only the record count exposed as an advanced override. Confirm these numbers with a staging load test before treating them as stable defaults. Do not call 1,000 a collector limit.

## 7. Timestamp and retention contract

This is non-negotiable for the feature:

- `startedAt = Langfuse startTime`.
- `endedAt = Langfuse endTime` for duration observations.
- `endedAt = startedAt` only for Langfuse `EVENT`, matching existing writer semantics.
- Never set `startedAt`, `endedAt`, or source `createdAt` to import time.
- Preserve Langfuse `createdAt` and `updatedAt` under provenance metadata because the collector ignores its top-level `createdAt`/`updatedAt` inputs and the query API synthesizes `createdAt` from `startedAt`.
- Do not upload incomplete non-event observations. The writer currently replaces a missing end with start time, which would falsely convert a running span into a completed zero-duration span.
- The source window is fixed once per run. A resume reuses the same `snapshotAt`/`cutoffAt`; it does not slide forward.
- Because ClickHouse TTL is `endedAt + 30 days`, imported data expires at the same wall-clock time it would have expired if it had arrived live. Importing it does not renew retention.

V0 defines “last 30 days” as traces whose import root **started** in the 30-day source window. This follows Langfuse's documented bounded-export path (`fromStartTime`/`toStartTime`) and avoids importing recent children without their older root. A hosted probe confirmed that the generic advanced filter currently accepts an `endTime` condition, but changing the product definition to “root ended in the last 30 days” would require a different tree-completeness strategy and explicit product approval. It is not silently inferred from ClickHouse's per-span TTL.

## 8. Identity, provenance, and re-import behavior

Use deterministic, namespaced OTel-compatible IDs so arbitrary legacy Langfuse IDs cannot violate the Mastra core contract or collide with native target traces:

```text
targetTraceId = first 32 lowercase hex chars of
  SHA-256("langfuse\0" + langfuseProjectId + "\0trace\0" + sourceTraceId)

targetSpanId = first 16 lowercase hex chars of
  SHA-256("langfuse\0" + langfuseProjectId + "\0observation\0" + sourceObservationId)
```

Hash every `parentObservationId` through the same span-ID function. Preserve all original identifiers in metadata. The source Langfuse project ID is part of the namespace, so two source projects cannot overwrite one another in a single Mastra project.

Every span carries:

```json
{
  "source": "langfuse",
  "importSource": "langfuse-api-v2",
  "importBatchId": "<stable UUID for this manifest>",
  "langfuseTraceId": "<original>",
  "langfuseObservationId": "<original>",
  "langfuseProjectId": "<original>"
}
```

Put these under the span `metadata` object. `metadata.source` is already promoted by the collector into `executionSource`; do not ask Platform for new columns in V0.

Stable target IDs plus the existing `traceId:spanId` dedupe key make resume and identical re-upload safe enough for the current store. Do not claim exactly-once behavior. A newly started re-import may contain updated source payloads, while the current `ReplacingMergeTree` has no explicit version column and query ordering ties on equal `endedAt`; V0 should be documented as a one-time immutable snapshot plus resume, not as a synchronization/upsert product.

## 9. Type mapping

### Observation type

Use a conservative mapping and always preserve the exact Langfuse type in metadata:

| Langfuse            | Mastra `SpanType`  | Notes                                                                                             |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| `EVENT`             | `generic`          | Set `isEvent=true`; end equals start.                                                             |
| `SPAN`              | `generic`          | No stronger semantics are available.                                                              |
| `GENERATION`        | `model_generation` | Populate model, parameters, usage, cost, and completion start when valid.                         |
| `AGENT`             | `agent_run`        | Preserve Langfuse-specific agent context in metadata.                                             |
| `TOOL`              | `tool_call`        | Input/output map directly; do not invent tool IDs.                                                |
| `CHAIN`             | `generic`          | Mastra workflow spans have stricter framework semantics that Langfuse `CHAIN` does not guarantee. |
| `RETRIEVER`         | `generic`          | Do not claim `rag_vector_operation`; a retriever may use a database or another non-vector source. |
| `EVALUATOR`         | `scorer_run`       | Preserve evaluator details; this is an execution span, not a Mastra score event.                  |
| `EMBEDDING`         | `rag_embedding`    | Populate model and recognized usage fields.                                                       |
| `GUARDRAIL`         | `generic`          | No exact Mastra span type exists.                                                                 |
| Unknown future type | `generic`          | Warn and preserve the raw type; do not fail the whole import.                                     |

### Field mapping

| Langfuse V2 field(s)                                                                  | Mastra field                                 | Rule                                                                                                                                                   |
| ------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                  | `spanId`                                     | Deterministic namespaced hash; preserve original in metadata.                                                                                          |
| `traceId`                                                                             | `traceId`                                    | Deterministic namespaced hash; null means the row cannot be imported as a trace.                                                                       |
| `parentObservationId`                                                                 | `parentSpanId`                               | Hash using the same observation namespace; physical parentage wins over `isRootObservation`.                                                           |
| `isRootObservation`                                                                   | metadata                                     | Preserve as a logical-root hint only. Do not null a real physical parent.                                                                              |
| `name`                                                                                | `name`                                       | Use value when nonempty; otherwise deterministic fallback `langfuse:<lowercase type>`.                                                                 |
| `startTime`, `endTime`                                                                | `startedAt`, `endedAt`                       | Preserve exactly after validating ISO timestamps.                                                                                                      |
| `input`, `output`                                                                     | `input`, `output`                            | Parse valid JSON; retain the exact raw string otherwise.                                                                                               |
| `environment`                                                                         | `metadata.environment`                       | Preserve by default; an explicit target-environment policy may override attribution but original stays in Langfuse metadata.                           |
| `userId`, `sessionId`                                                                 | metadata promoted keys                       | The collector promotes these into stored correlation columns.                                                                                          |
| `tags`                                                                                | root `tags`                                  | Mastra tags are root-only. Keep repeated/non-root source tags in nested Langfuse metadata.                                                             |
| `level`, `statusMessage`                                                              | `error` plus metadata                        | For `ERROR`, set a structured `SpanErrorInfo` with the source message; all levels/messages remain in metadata. Do not convert `WARNING` into an error. |
| `model` (legacy fallback: `providedModelName`)                                        | typed `attributes.model`                     | Only on generation/embedding mappings; also retain raw model fields.                                                                                   |
| `modelParameters`                                                                     | typed parameters where compatible + metadata | Copy only supported, correctly typed canonical parameters. Preserve the complete source object separately.                                             |
| `inputUsage`, `outputUsage`, `totalUsage`, `usageDetails`                             | typed usage + metadata                       | Map recognized token totals/details; preserve the full arbitrary maps to avoid loss.                                                                   |
| `totalCost`, `costDetails`                                                            | `attributes.costContext` + metadata          | Use `estimatedCost`, `costUnit: "USD"`, and raw cost detail metadata when numeric. Preserve decimal-price strings without coercive rounding.           |
| `usagePricingTierId`, `usagePricingTierName`                                          | metadata                                     | Preserve both source pricing-tier identifiers exactly; do not infer target billing semantics.                                                         |
| `completionStartTime`                                                                 | generation `attributes.completionStartTime`  | Preserve if valid; keep timing metrics in source metadata too.                                                                                         |
| prompt fields                                                                         | metadata                                     | No canonical Mastra prompt reference exists on a generic imported span.                                                                                |
| `version`, `release`, `bookmarked`, `public`, metrics, source `createdAt`/`updatedAt` | metadata                                     | Preserve without inventing target semantics.                                                                                                           |
| source `metadata`                                                                     | nested `langfuseMetadata`                    | Require a record for target schema; wrap scalar/array source values instead of dropping them.                                                          |

The final target schema is the collector's actual wire DTO (`spanId`, `spanType`, `startedAt`, `endedAt`, `error`), not the in-memory `ExportedSpan` names (`id`, `type`, `startTime`, `endTime`, `errorInfo`). Make the serializer boundary explicit and test it against the current exporter and collector fixtures.

## 10. CLI contract

Proposed V0 usage:

```text
LANGFUSE_PUBLIC_KEY=pk-lf-... \
LANGFUSE_SECRET_KEY=sk-lf-... \
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com \
MASTRA_PLATFORM_ACCESS_TOKEN=sk_... \
MASTRA_PROJECT_ID=... \
mastra traces import --provider langfuse
```

Options:

- `--provider langfuse` (required in V0 so future providers do not change syntax)
- `--project <id-or-slug>` (overrides env/config; resolve slug through the authenticated Platform API)
- `--platform-url <origin>` (or existing `MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT`; supports staging/self-hosted collector testing)
- `--environment <name>` (explicit target attribution override; otherwise preserve each Langfuse value)
- `--dry-run`
- `--resume <import-id>`
- `--state-dir <path>`
- `--batch-size <count>` (advanced, capped by a hard safety maximum)
- `--json` for automation
- `--yes` to suppress confirmation after the dry-run summary

The command should print the immutable window, source host/project ID, target project, target collector origin, environment policy, eligible/skipped trace and span counts, estimated payload bytes, and the exact resume ID before asking for confirmation. The organization is authoritative from the ingestion key but is not returned by the collector contract, so the CLI cannot safely print it. Never print either source or target secret.

Suggested exit codes:

- `0`: complete, including a no-op import with zero eligible traces.
- `1`: validation/configuration/permanent API failure.
- `2`: paused and resumable (quota, transient failure after retry budget, or interruption).
- `130`: SIGINT; manifest safely checkpointed and resumable.

## 11. Authentication and private Platform boundary

### V0 recommendation: existing organization key

- Require an `sk_*` organization API key from `MASTRA_PLATFORM_ACCESS_TOKEN`.
- Accept `MASTRA_CLOUD_ACCESS_TOKEN` only as a deprecated fallback and emit a rename warning. Never fall back to the ordinary `mastra auth login` user token for collector writes.
- Resolve project ID in OSS, place it in the project-scoped URL, and let Platform verify that the key's organization owns it.
- Send provider provenance only as normal span metadata.
- Do not expose or duplicate ClickHouse table definitions, tenant lookup, quota state, or Pub/Sub details in OSS.
- Do not mint a fresh permanent organization key automatically on each import. Users can reuse the key provisioned by `mastra init --observability` or explicitly create one through the existing token workflow.

### Optional prerequisite: normal CLI login token UX

If maintainers require the import to work after only `mastra auth login`, add a narrow exchange in Platform rather than widening the existing API-key middleware or proxying every trace through the main API:

1. Add a protected Platform API endpoint under `/v1/auth/ingest/session` with schemas in `services/auth`.
2. Input: target `projectId` and optional target environment. The authenticated user/session and selected organization are authoritative.
3. Validate organization membership, project ownership, environment ownership, and observability availability.
4. Return a short-lived, expiring Platform JWT with `teamId`, `projectId`, `product`, and optional trusted environment claims, plus the correct regional collector origin.
5. The CLI sends the data directly to existing `/ai/spans/publish`; `authenticateToken` already verifies Platform-signed JWTs and binds tenant scope from claims.
6. Add a purpose/audience claim and enforce it if least-privilege import-only credentials are required. Do not return a long-lived WorkOS key.

This prerequisite would make the diagram's JWT claim true. It is not present today, and closed Platform PR #593 is evidence that JWT support on the project-key route was considered but not merged. V0 has therefore chosen the organization-key route and must not optimistically try both credential types.

## 12. Manifest and resume semantics

Store state at `~/.mastra/imports/<target-project>/<import-id>/` by default, created with user-only permissions:

```text
manifest.json
source-pages.jsonl
shards/...
report.json
```

Manifest fields include:

- format/schema version;
- import ID/batch ID;
- provider and non-secret source identity (host + Langfuse project ID);
- target project and collector origin;
- `snapshotAt` and `cutoffAt`;
- selected field groups and source cursor;
- source pages/rows read;
- normalized trace/span counts and skip counts by reason;
- deterministic hash/shard version;
- target batch boundaries, content hashes, status, attempts, and acknowledgement time;
- enqueue results plus deterministic verification samples, query attempts, verified count, and `verified`/`partial`/`timed-out`/`unavailable` status.

Write manifests atomically (temporary sibling + rename). Reject a changed provider host, target project, time window, ID algorithm, mapper version, or any saved batch hash. The importer learns the Langfuse project ID from the rows and rejects a project change between source pages. After batches are planned, a resume doesn't read Langfuse again, so changing the source credential cannot alter the saved project or payload and doesn't need to block upload. Never store secrets or full secret-bearing request headers.

On success, remove raw trace spools by default and retain a small summary manifest/report. Provide an explicit keep-state debugging option if maintainers want it; warn that trace inputs/outputs may contain sensitive data.

## 13. Error and retry policy

### Langfuse reads

- 401/403: permanent credential/authorization error.
- 404 on V2 route: report unsupported host/version and point self-hosted V3 users to the compatibility limitation.
- 429: wait exactly `Retry-After`, checkpoint, and retry.
- Network/408/5xx: bounded exponential backoff with jitter; preserve cursor and pause resumably when exhausted.
- Invalid response schema: fail before any target writes unless resuming an already-staged run.

### Platform writes

- 200: require `{ ok: true, data: { spanCount } }` and exact accepted count before checkpointing the batch.
- 400: permanent importer/contract error. Local validation should make this a test failure, not a skippable record error.
- 401: permanent for API-key V0. Do not substitute the user login token.
- 403/404: permanent project ownership/routing error.
- 402 with `quota-pause-v1`: checkpoint and exit paused/resumable; do not drop or spin indefinitely.
- 429: honor `Retry-After` if present; otherwise bounded exponential backoff.
- 500/502/503/504/network timeout: retry the identical batch with jitter. Stable IDs make duplicate enqueue safe enough.
- 204: treat as a protocol error for a capability-aware importer, because it means a legacy quota-drop response and must not be reported as success.
- Unexpected warning: surface it. `MISSING_STABLE_ID` should never occur for spans because trace/span IDs are required and supplied.

The final report must distinguish `read`, `eligible`, `skipped`, `enqueued`, and `verified`; “enqueued” must not be labeled “stored.” Query 404, 429, 5xx, and network failures are retried within a short bounded polling budget because storage is asynchronous. Query 401/403 or malformed responses produce `unavailable`; timeout produces `timed-out` or `partial`. These verification outcomes do not turn an already acknowledged upload into a failed upload.

### Unusual trace policy

- Langfuse has no separate cancelled/aborted observation state. A completed `ERROR` observation is imported with its error and status message; a non-event without `endTime` is treated as incomplete and its entire trace is skipped.
- `EVENT` is a point-in-time observation and may omit `endTime`; Mastra receives `endedAt = startedAt`.
- `WARNING` and `DEBUG` remain provenance levels and do not become Mastra errors.
- Structural ambiguity is never repaired silently. Missing unmarked roots/parents, multiple roots, duplicate IDs, and cycles are skipped as complete trace units. A Langfuse SDK application root explicitly marked with `isRootObservation: true` is detached only when its physical parent isn't part of the exported trace; that source parent ID is preserved in metadata.
- Valid zero-duration observations and children outside the parent's time range are retained because asynchronous work and clock behavior can produce them without corrupting physical parentage.
- Unknown future Langfuse types map to `generic` with a warning and retain the original type.
- A user cancellation before upload retains the staged plan; interruption during source read, upload, or verification pauses checkpointed state for resume.
- V2 returns I/O as raw strings. Valid JSON is parsed and non-JSON text is retained. A literal source string containing valid JSON text cannot be distinguished from serialized JSON and is parsed; report this as an API-contract limitation.

## 14. Implementation sequence

### A. Lock decisions and contract

1. Treat the six evidence-based choices in section 17 as the V0 contract; reopen one only if a maintainer intentionally changes product scope.
2. Capture import-shaped span fixtures in both repositories.
3. In Platform tests, prove the existing project route accepts the fixture, derives organization/project from auth, preserves source timestamps/environment/provenance, rejects a bad record atomically, and produces the expected writer row/dedupe key.
4. Add Platform regression coverage proving that an organization API key can read the project-scoped light trace query. No new Platform runtime path is needed.

### B. OSS import package

1. Scaffold `observability/trace-import` and its focused package guidance/tests.
2. Add strict Zod schemas for Langfuse V2 requests/responses and the target collector DTO. Put deterministic constraints in schemas; keep HTTP/runtime checks in client code.
3. Implement source paging, fixed snapshot bounds, rate-limit handling, and secure spool/manifest writes.
4. Implement tree assembly/validation and deterministic ID/provenance helpers.
5. Implement the complete mapping table above, including all ten current observation types and future-type fallback.
6. Implement dual-threshold batching, status-specific retries, acknowledgement validation, and checkpointing.
7. Implement bounded, exact-ID post-upload verification against the existing light trace query.

### C. CLI

1. Register `mastra traces import` in `packages/cli/src/index.ts`.
2. Reuse existing dotenv, project config, organization selection, credential, output, analytics-shutdown, and signal-handling patterns.
3. Keep target ingestion key resolution separate from `getToken()` so a login token cannot be sent to the wrong collector route.
4. Add interactive confirmation, `--dry-run`, `--resume`, `--json`, redaction, and deterministic exit codes.

### D. Documentation and release metadata

1. Document source credentials/regions/self-hosted V4 requirement, target credentials, the precise 30-day semantics, original-time TTL behavior, skipped trace rules, security of local state, quota behavior, and resume.
2. State explicitly that V0 imports traces only; it does not backfill Platform metric rows or migrate Langfuse scores, feedback, comments, datasets, prompt entities/content, or attachments. Prompt references carried by observations remain as source metadata.
3. Add appropriate changesets after reading `.mastracode/commands/changeset.md`, using literal model IDs where any examples require them.

## 15. Test and verification plan

### OSS unit/contract tests

- Every Langfuse V2 field group, nullability case, and all ten observation types.
- Unknown future type falls back to generic and retains its raw value.
- JSON and non-JSON input/output round-trip.
- Model parameters, token details, decimal price strings, cost maps, and `usagePricingTierId`/`usagePricingTierName` retain precision/source data.
- Physical vs logical root behavior.
- Missing root/parent, duplicate IDs, cycle, invalid time, incomplete duration, and trace-level all-or-nothing skipping.
- Exact 30-day boundaries and fixed snapshot on resume.
- Deterministic IDs across resume/re-run and separation across Langfuse projects.
- Root-only target tags and promoted metadata fields.
- 100-record/byte-limit batching, including one oversized record and one oversized trace.
- Langfuse cursor/429/retry behavior.
- Every Platform response class in section 13.
- Manifest atomicity, interruption at every state boundary, content-hash mismatch, and secret redaction.
- CLI project/credential precedence, deprecated `MASTRA_CLOUD_ACCESS_TOKEN` fallback, noninteractive behavior, JSON output, SIGINT, and no user-login-token fallback.

### Platform focused tests

- Existing collector schema accepts the shared import fixture and rejects drift.
- API-key organization/project ownership remains authoritative.
- Organization API keys can authenticate the project-scoped light trace read used by verification.
- `startedAt` and `endedAt` arrive unchanged at `transformSpanRecord`.
- Root and branch materialized-view eligibility follows physical parent IDs.
- Identical deterministic IDs produce the expected `traceId:spanId` dedupe key.
- Truncation behavior is reported/documented for >1 MiB fields.
- 402 capability response, 400 atomic validation, and 500 publish failure remain resumable from the CLI contract.
- If token exchange is selected: membership/project/environment/region, expiry, wrong audience/purpose, cross-project rejection, and refresh behavior.

### Staging smoke test

Unit and contract tests do not need real credentials. The hosted smoke test uses only disposable, non-production credentials: a Langfuse V4 project public/secret key pair and base URL, plus a Mastra Platform organization API key, project ID, and regional collector endpoint. Inject them through the local environment or an approved secret manager; do not paste them into the plan, chat, fixtures, shell history, or commits.

### Hosted evidence captured on 2026-09-03

- The Langfuse V2 source returned 20 observations forming 2 complete traces; all were inside the fixed 30-day root-start window.
- The unmerged CLI dry-run reported 20 eligible spans, 2 eligible traces, zero skips, and preserved the original source timestamps.
- The normal project-scoped collector acknowledged all 20 spans.
- The same organization key successfully queried both deterministic trace IDs through `/api/observability/traces/:traceId/light`; readback contained all 20 unique expected span IDs, one physical root per trace, no broken parents, and provenance on every span.
- Publishing the same deterministic batch twice still produced 2 logical trace roots through the query API, matching the existing eventual-deduplication contract.
- No direct ClickHouse credential or connection was used. A transient local DNS failure was observed separately and correctly exhausted the upload retry budget without corrupting checkpoint state.

### Edge-case hosted evidence captured on 2026-09-03

- A synthetic disposable Langfuse trace exercised all ten documented observation types: `SPAN`, `GENERATION`, `EVENT`, `AGENT`, `TOOL`, `CHAIN`, `RETRIEVER`, `EVALUATOR`, `EMBEDDING`, and `GUARDRAIL`. It also contained object/array/scalar I/O, a completed `ERROR` generation with `Request aborted by user`, a `WARNING` tool, and zero-duration observations.
- The V2 API briefly exposed 9 of the 10 observations before the generation became visible, confirming that source visibility can be eventual even when the current SDK uses immediate export. The bounded historical snapshot later returned the complete trace.
- The unmerged CLI dry-run read 30 observations across 3 complete traces, found all 30 spans eligible, skipped none, and reported no truncation risk.
- The first upload attempt encountered a real local DNS-resolution failure, exhausted four retries, acknowledged zero spans, and paused with the original batch hash intact.
- Resuming that exact checkpoint through the same HTTPS hostname enqueued all 30 spans. Query verification reached `verified` for all 3 sampled traces after five polling attempts.
- The edge trace query returned all 10 expected deterministic span IDs, one physical root, zero broken parents, preserved timestamps, the aborted generation as a Mastra error span, the warning without false error classification, and the event as a point-in-time span.
- No direct ClickHouse credential or connection was used for this test.

### Final hardening evidence captured on 2026-09-03

- A supported OTLP write created an observation with a non-null parent that was absent from its trace. Langfuse returned `isRootObservation: false`, proving that an arbitrary missing parent must remain a structural skip. The importer only detaches the documented `isRootObservation: true` application-root form.
- A future-ending observation was visible in the fixed start-time read. Before the snapshot-completion guard it was incorrectly eligible; after the guard, the same 32-row source produced 30 eligible spans in 3 traces and skipped that trace with `completed_after_snapshot`.
- The Platform API key resolved its bound organization through `/v1/auth/verify`; the configured old project ID was stale, while the same key returned two current projects through `/v1/projects`.
- A real CLI dry run resolved a current project by slug and staged all source rows. The subsequent `--resume` process had no Langfuse public key, secret key, or base URL, yet it enqueued the staged 30 spans and verified all 3 sampled traces through the existing light query API.
- The live V2 `usage` field group returned `usagePricingTierId` and `usagePricingTierName` as strings on 2 observations; both fields were present on the corresponding 2 normalized Mastra spans.
- A synthetic load run staged and planned 50,000 observations belonging to one trace across 50 source pages and 500 target batches in 5.96 seconds, with zero skips. The 13.54 MiB spool reached about 320 MiB process RSS, documenting that a pathological single enormous trace is still the memory worst case even though ordinary projects are distributed across 64 disk shards.
- The hosted run encountered a local DNS resolver failure for `platform.mastra.ai`. The endpoint itself was confirmed through its current public DNS record, and the test used a loopback HTTPS-forwarding proxy solely as a local DNS workaround; collector and query traffic still used their normal public HTTPS hosts.

1. Seed Langfuse with a trace containing generation, tool, event, agent, embedding, warning, and error observations; include JSON/string I/O and source metadata.
2. Include traces just inside/outside the cutoff, an incomplete trace, an orphan, and a very large field.
3. Run dry-run and compare the report to the seed.
4. Interrupt after several target batches, resume, and compare batch hashes.
5. Re-run the identical completed manifest and verify no duplicate logical spans.
6. Query the imported trace by deterministic ID and compare tree shape, I/O, type mapping, provenance, environment, and timestamps.
7. Verify a near-expiry trace retains only its remaining TTL and was not re-dated.
8. Force source 429, target 402, target 500, and delayed ClickHouse visibility.
9. Confirm native live traces and imported traces use the same trace query/view without changing existing collector behavior.

Use the narrowest package commands first:

```text
pnpm --filter @mastra/trace-import test
pnpm --filter @mastra/trace-import lint
pnpm --filter @mastra/trace-import build
pnpm --filter mastra test
pnpm --filter mastra typecheck

# Platform
pnpm --filter @platform/mobs-collector test
pnpm --filter @platform/mobs-collector typecheck
pnpm --filter @platform/mobs-ch-writer test
```

Adjust the exact Platform filters after checking package scripts; do not run root E2E before focused suites pass.

## 16. Security and operational constraints

- Never log or persist Langfuse secret keys, Platform keys, Authorization headers, raw environment variables, or signed URLs/tokens.
- Treat staged trace data as sensitive; user-only permissions, explicit location, bounded disk use, and cleanup are required.
- Validate the Langfuse host as an HTTP(S) origin, strip credentials/fragments, and require HTTPS except explicit localhost development.
- Do not follow cross-origin redirects with an Authorization header.
- Validate a custom collector URL and never attach Platform credentials to an untrusted default/redirected origin without explicit user configuration.
- Apply source response-size limits and target request byte limits. One pathological input/output must not exhaust CLI memory.
- Imported spans count against the existing observability quota because they use the normal collector. The confirmation/report must say this.
- Preserve Platform tenant authority: ignore any source organization/project claims for routing.
- Track provider, mapper version, counts, duration, retry counts, skip reasons, and terminal state in CLI analytics, but never send trace contents or source IDs.

## 17. Decisions made from code and provider contracts

These are the V0 decisions. They do not need credentials or maintainer input unless a maintainer wants to change the product scope deliberately:

1. **Authentication:** Require the existing `MASTRA_PLATFORM_ACCESS_TOKEN=sk_*` organization key and project-scoped route. Accept `MASTRA_CLOUD_ACCESS_TOKEN` only as a warned deprecated environment-name fallback. Do not add Platform runtime code or use the ordinary CLI login token in V0. A login-only experience is a later enhancement through a short-lived token exchange.
2. **30-day definition:** Import complete traces whose import root `startTime` is in the immutable 30-day window, using Langfuse's documented bounded start-time parameters. Retention still uses the untouched source `endedAt`. An end-time-based product definition is technically possible through a different read/tree strategy, but is not assumed from the storage TTL and requires explicit product approval.
3. **Identity:** Use deterministic namespaced hashes for valid Mastra/OTel IDs and collision isolation. Preserve every original Langfuse ID in metadata.
4. **Signals:** Import observation spans only. Do not backfill Platform metric rows, and do not migrate scores/feedback until Platform has a lossless representation for every Langfuse score type.
5. **Environment/region:** Preserve each Langfuse environment label by default, with `--environment` as an explicit attribution override. Resolve collector placement from `MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT`; default to the production US origin only when it is absent, matching the existing exporter. Non-US imports must configure the regional endpoint explicitly because the current project config does not contain enough information to infer it safely.
6. **Verification:** Report collector acknowledgements as enqueued, then use the same organization key with `X-Mastra-Project-Id` to query a deterministic sample of at most 10 traces through the existing light trace API. Report the exact sample result without claiming direct ClickHouse access, full-population verification, exactly-once storage, or proof that a repeated upload replaced an already-queryable logical span.

Maintainer review is still valuable for approving scope, but implementation is no longer blocked on unanswered technical decisions.

## 18. Acceptance criteria

- A user can dry-run and import a supported Langfuse Cloud/self-hosted V4 project from the CLI.
- Only complete, valid traces in the defined root-start 30-day window are enqueued; every skip has a reason and count.
- The imported physical tree, input/output, supported semantic fields, and source provenance are queryable in the same Platform trace APIs/views as live Mastra traces.
- `startedAt` and `endedAt` equal the source values exactly; no migrated trace is re-dated to import time.
- Remaining retention is determined by original `endedAt + 30 days`.
- Interruption, source rate limiting, target transient errors, and quota pause are resumable without changing target IDs or acknowledged batch contents.
- Organization/project attribution cannot be supplied or overridden by Langfuse data.
- A repeated identical upload produces one logical span per deterministic `traceId:spanId`, with the documented eventual-dedupe caveat.
- No Studio code or UI is added.
- No Langfuse scores/feedback/metrics are silently coerced or represented as something they are not.

## 19. History reviewed

### OSS Mastra

- [#15189: project-scoped API-key endpoints](https://github.com/mastra-ai/mastra/pull/15189) established the current collector URL contract.
- [#15728: end-to-end observability onboarding](https://github.com/mastra-ai/mastra/pull/15728) established project selection, organization-key minting, and `.env` conventions.
- [#16223: MastraPlatformExporter](https://github.com/mastra-ai/mastra/pull/16223) established the current span wire conversion and live export behavior.
- [#21447: quota-pause capability](https://github.com/mastra-ai/mastra/pull/21447) established the 402/capability protocol an importer must advertise.
- [#22480: platform endpoint override](https://github.com/mastra-ai/mastra/pull/22480) fixed region/custom-endpoint resolution and is relevant to import targeting.

### Private Platform

- [#373: WorkOS API-key ingest auth](https://github.com/mastra-ai/platform/pull/373) added the project-scoped authorization seam.
- [#532: corrected project-scoped paths](https://github.com/mastra-ai/platform/pull/532) established `/projects/:projectId/ai/...`.
- [#593: JWT fallback attempt](https://github.com/mastra-ai/platform/pull/593) was closed without merge; do not assume project routes accept JWTs.
- [#1086: missing stable signal IDs](https://github.com/mastra-ai/platform/pull/1086) kept spans strict while allowing generated IDs for other signals.
- [#1095: writer-side stable IDs](https://github.com/mastra-ai/platform/pull/1095) established persisted signal IDs and dedupe behavior.
- [#2545: MOBS TTL/schema reconciliation](https://github.com/mastra-ai/platform/pull/2545) confirms the current 30-day `endedAt` retention source of truth.

## 20. External documentation verified

- [Langfuse Observations API V2](https://langfuse.com/docs/api-and-data-platform/features/observations-api)
- [Langfuse Public API authentication and regional URLs](https://langfuse.com/docs/api-and-data-platform/features/public-api)
- [Langfuse CLI environment-variable conventions](https://langfuse.com/docs/api-and-data-platform/features/cli)
- [Langfuse observation types](https://langfuse.com/docs/observability/features/observation-types)
- [Langfuse API limits and Retry-After behavior](https://langfuse.com/faq/all/api-limits)
- [Langfuse deprecated API migration](https://langfuse.com/faq/all/deprecated-api-migration)
- [Langfuse Scores API V3](https://langfuse.com/docs/api-and-data-platform/features/scores-api)
- [Langfuse observations-first data model](https://langfuse.com/docs/observability/data-model)
- [Langfuse one-off UI exports](https://langfuse.com/docs/api-and-data-platform/features/export-from-ui)
- [Langfuse manifest-driven blob exports](https://langfuse.com/docs/api-and-data-platform/features/export-to-blob-storage)
- [Langfuse blob export field/type differences](https://langfuse.com/docs/api-and-data-platform/features/blob-storage-export-fields)
- [Mastra Platform observability pipeline overview](https://mastra.ai/blog/announcing-mastra-observability)

## 21. Remaining product confirmation

The only unresolved pre-PR item is an external scope confirmation: the implementation and documentation assume the customer's V0 request is **traces only**. No codebase or provider contract can prove the customer's intent. Ask the customer-facing engineer or maintainer:

> For V0, can you confirm the customer needs Langfuse traces/observations only, with scores, feedback/comments, logs, metrics, prompts, datasets, and file/database migration explicitly out of scope?

Do not expand the implementation until that answer changes the approved scope.
