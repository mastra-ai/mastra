# API Smoke Test Coverage

> 218 tests across 38 test files — last updated 2026-03-20

**Test runner:** Vitest
**Test dir:** `e2e-tests/smoke/tests/`

> **Legend:** &ensp; ✅ Tested &ensp; ⬜ Not tested &ensp; 🔒 Requires setup

---

## Summary

| Section        | Progress                          | Tests | Status |
|----------------|-----------------------------------|-------|--------|
| Workflows      | ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅ | 73    | Complete |
| Agents         | ✅✅✅✅✅✅✅✅                    | 26    | Complete |
| Datasets       | ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅ | 19    | Complete |
| Workspace      | ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅ | 22    | Complete |
| MCP            | ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅      | 17    | Complete |
| Processors     | ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅      | 17    | Complete |
| Tools          | ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅          | 15    | Complete |
| Memory         | ✅✅✅✅✅✅✅✅✅✅✅✅✅✅            | 14    | Complete |
| Scores         | ✅✅✅✅✅✅✅✅✅✅✅                | 11    | Complete |
| Observability  | ✅✅✅✅✅✅✅                      | 7     | Partial |
| Vector Store   | ⬜⬜⬜⬜⬜⬜⬜⬜                  | 0/8   | 🔒 Needs embedder + vector config |
| Logs           | ⬜⬜⬜                            | 0/3   | 🔒 Needs logger transports |
| **Total**      |                                   | **218** |      |

---

## ✅ What's Tested

### Workflows (73 tests, 17 files)

#### Basic Execution — `basic.test.ts` (7 tests)

| Test | Status |
|------|--------|
| Sequential steps — chain 3 steps, produce combined message | ✅ |
| Schema validation — valid input accepted | ✅ |
| Schema validation — value too high rejected | ✅ |
| Schema validation — wrong type rejected | ✅ |
| Schema validation — boundary value 0 (minimum) | ✅ |
| Schema validation — boundary value 100 (maximum) | ✅ |
| Schema validation — below minimum rejected | ✅ |
| Map between steps — fullName to displayName mapping | ✅ |

#### Control Flow — `control-flow.test.ts` (9 tests)

| Test | Status |
|------|--------|
| Branch — positive branch for positive values | ✅ |
| Branch — negative branch for negative values | ✅ |
| Branch — boundary value 0 (positive per >= 0) | ✅ |
| Parallel — 3 concurrent steps with collected results | ✅ |
| Do-while — loop until count reaches 5 | ✅ |
| Do-while — executes at least once at threshold | ✅ |
| Do-until — accumulate until total reaches 50 | ✅ |
| Do-until — executes at least once at threshold | ✅ |
| Foreach — process each item in array | ✅ |

#### Suspend/Resume — `suspend-resume.test.ts` (5 tests)

| Test | Status |
|------|--------|
| Basic suspend — returns suspend payload | ✅ |
| Basic suspend — resume with data and complete | ✅ |
| Basic suspend — handle rejection on resume | ✅ |
| Parallel suspend — suspend both parallel branches | ✅ |
| Parallel suspend — resume individual branches by step ID | ✅ |
| Loop suspend — suspend on each loop iteration and resume | ✅ |
| Loop suspend — execute once and stop at threshold | ✅ |

#### State Management — `state.test.ts` (2 tests)

| Test | Status |
|------|--------|
| Stateful workflow — accumulate state across steps | ✅ |
| Initial state — start with provided initialState | ✅ |

#### State + Suspend — `state-suspend.test.ts` (4 tests)

| Test | Status |
|------|--------|
| State persist across suspend/resume cycle | ✅ |
| State persist across suspend/resume with rejection | ✅ |
| State accumulation inside do-while loop | ✅ |
| State access in parallel branches | ✅ |

#### Nested Workflows — `nested.test.ts` (1 test) + `nested-advanced.test.ts` (2 tests)

| Test | Status |
|------|--------|
| Inner workflow as a step — pass data through | ✅ |
| Deep nesting — 2 levels of nesting | ✅ |
| Nested suspend — suspend inside nested workflow and resume | ✅ |

#### Error Handling — `error-handling.test.ts` (2 tests)

| Test | Status |
|------|--------|
| Retry workflow — succeed after retries | ✅ |
| Failure workflow — report failed status with exact error shape | ✅ |

#### Foreach Errors — `foreach-errors.test.ts` (3 tests)

| Test | Status |
|------|--------|
| Foreach item throws — workflow fails with exact error | ✅ |
| Foreach no items throw — workflow succeeds | ✅ |
| Foreach flaky item with retry — succeeds after retries | ✅ |

#### Sleep — `sleep.test.ts` (1 test)

| Test | Status |
|------|--------|
| 2s sleep completes and reports elapsed time within bounds | ✅ |

#### Streaming — `streaming.test.ts` (2 tests) + `streaming-advanced.test.ts` (3 tests)

| Test | Status |
|------|--------|
| Stream sequential-steps with proper chunk types | ✅ |
| Stream suspend then stream resume with proper events | ✅ |
| Stream failed workflow with error event and step-level error | ✅ |
| Stream workflow that retries and eventually succeeds | ✅ |
| Stream parallel suspend events for multiple branches + resume both | ✅ |

#### Concurrent Suspend — `concurrent-suspend.test.ts` (2 tests)

| Test | Status |
|------|--------|
| Resume both parallel branches simultaneously | ✅ |
| Independent suspend/resume across concurrent runs | ✅ |

#### Cancel — `cancel-suspended.test.ts` (2 tests)

| Test | Status |
|------|--------|
| Cancel a workflow in suspended state | ✅ |
| Not resumable after cancellation | ✅ |

#### Run Management — `run-management.test.ts` (7 tests)

| Test | Status |
|------|--------|
| List all registered workflows | ✅ |
| Get single workflow metadata | ✅ |
| List runs after starting a workflow (with snapshot shape) | ✅ |
| Get run details by ID | ✅ |
| Delete a run (+ verify 404) | ✅ |
| Cancel a running workflow (via poll + cancel) | ✅ |
| Time-travel — re-execute from a specific step | ✅ |
| Restart an active workflow run | ✅ |

#### API Endpoint Variants — `api-endpoints.test.ts` (4 tests)

| Test | Status |
|------|--------|
| Sync /start (fire-and-forget) + poll for completion | ✅ |
| Sync /resume (fire-and-forget) + poll for completion | ✅ |
| /create-run — pre-create and verify | ✅ |
| /time-travel-stream — stream time-travel re-execution | ✅ |

#### Edge Cases — `edge-cases.test.ts` (5 tests)

| Test | Status |
|------|--------|
| 404 for non-existent workflow | ✅ |
| 404 for non-existent run | ✅ |
| 404 for non-existent workflow metadata | ✅ |
| 500 when resuming a completed (non-suspended) run | ✅ |
| 500 when time-traveling to non-existent step | ✅ |
| Foreach with empty array | ✅ |
| Foreach with single item | ✅ |
| Multiple concurrent runs of the same workflow | ✅ |

---

### Agents (26 tests, 8 files)

#### Discovery — `agents.test.ts` (4 tests)

| Test | Status |
|------|--------|
| List all registered agents | ✅ |
| Get agent metadata by ID (name, instructions, source, description) | ✅ |
| Agent tools included in metadata (keys, ids, descriptions) | ✅ |
| 404 for non-existent agent | ✅ |

#### Generate — `generate.test.ts` (6 tests)

| Test | Status |
|------|--------|
| Simple text generation (response text, finishReason) | ✅ |
| Usage information (inputTokens, outputTokens) | ✅ |
| Tool use — calculator (multiply 7x6, verify tool result = 42) | ✅ |
| Tool use — string-transform (uppercase, verify exact result) | ✅ |
| Multi-turn with memory — recall fact across thread turns | ✅ |
| 404 for non-existent agent | ✅ |

#### Stream — `stream.test.ts` (3 tests)

| Test | Status |
|------|--------|
| Text streaming — event sequence (start > text-delta > step-finish > finish), usage info | ✅ |
| Tool use streaming — tool-call + tool-result events with exact result | ✅ |
| 404 for non-existent agent | ✅ |

#### Structured Output — `structured-output.test.ts` (2 tests)

| Test | Status |
|------|--------|
| Generate with structuredOutput — JSON response matching schema | ✅ |
| Stream with structuredOutput — text deltas form valid structured JSON | ✅ |

#### Stream with Memory — `stream-memory.test.ts` (1 test)

| Test | Status |
|------|--------|
| Multi-turn recall across thread turns via stream endpoint | ✅ |

#### Tool Approval — `tool-approval.test.ts` (2 tests)

| Test | Status |
|------|--------|
| Approve tool call — pause on tool-call-approval, resume with tool result | ✅ |
| Decline tool call — pause on tool-call-approval, resume with rejection message | ✅ |

#### Providers — `providers.test.ts` (2 tests)

| Test | Status |
|------|--------|
| List available providers with expected shape (id, name, connected) | ✅ |
| OpenAI listed as a connected provider | ✅ |

#### Agent-Scoped Tools — `agent-tools.test.ts` (6 tests)

| Test | Status |
|------|--------|
| Get calculator tool metadata through agent endpoint | ✅ |
| Get string-transform tool metadata through agent endpoint | ✅ |
| 404 for tool not assigned to agent (always-fails) | ✅ |
| Execute calculator through agent endpoint (exact result) | ✅ |
| Execute string-transform through agent endpoint (exact result) | ✅ |
| 404 when executing tool not assigned to agent | ✅ |

---

### Tools (15 tests, 1 file)

#### Discovery — `tools.test.ts`

| Test | Status |
|------|--------|
| List all registered tools (verify by tool ID) | ✅ |
| Get tool by ID with schema (inputSchema, outputSchema via superjson) | ✅ |
| 404 for non-existent tool | ✅ |

#### Execution — `tools.test.ts`

| Test | Status |
|------|--------|
| Calculator — addition (10 + 32 = 42) | ✅ |
| Calculator — multiplication (7 x 6 = 42) | ✅ |
| Calculator — subtraction (100 - 58 = 42) | ✅ |
| Calculator — division (84 / 2 = 42) | ✅ |
| String-transform — uppercase | ✅ |
| String-transform — reverse | ✅ |
| String-transform — length | ✅ |
| Timestamp — no input, returns timestamp + ISO string | ✅ |
| 500 when executing tool that throws | ✅ |
| 500 when dividing by zero | ✅ |
| Validation error for missing required fields (200 with error shape) | ✅ |
| 404 when executing non-existent tool | ✅ |

---

### MCP (17 tests, 2 files)

#### REST API — `rest.test.ts` (11 tests)

| Test | Status |
|------|--------|
| List registered MCP servers (name, version, is_latest) | ✅ |
| Get server details by ID | ✅ |
| 404 for non-existent server | ✅ |
| List tools on MCP server (calculator, string-transform) | ✅ |
| Get tool details with input schema | ✅ |
| 404 for non-existent tool on valid server | ✅ |
| 404 for tool on non-existent server | ✅ |
| Execute calculator via MCP REST endpoint (exact result) | ✅ |
| Execute string-transform via MCP REST endpoint (exact result) | ✅ |
| 500 when executing non-existent tool | ✅ |
| Validation error for missing required fields (200 with error shape) | ✅ |

#### Client Transport — `client.test.ts` (6 tests)

| Test | Status |
|------|--------|
| Connect and list tools via Streamable HTTP transport | ✅ |
| Execute calculator tool via Streamable HTTP | ✅ |
| Execute string-transform tool via Streamable HTTP | ✅ |
| Connect and list tools via SSE fallback transport | ✅ |
| Execute calculator tool via SSE transport | ✅ |
| Execute string-transform tool via SSE transport | ✅ |

---

### Observability (7 tests, 1 file)

#### Traces — `traces.test.ts` (7 tests)

| Test | Status |
|------|--------|
| List spans with pagination (total, page, perPage, hasMore) | ✅ |
| Span shape — traceId (hex32), spanId (hex16), name, spanType, startedAt | ✅ |
| Workflow spans present — entityType, entityId, name pattern | ✅ |
| Successful workflow spans with timing (startedAt <= endedAt) | ✅ |
| Pagination — page 0 and page 1 return distinct spans | ✅ |
| Get trace by ID — all spans share traceId, span shape verified | ✅ |
| 404 for non-existent trace | ✅ |

---

### Memory (14 tests, 3 files)

#### Threads — `threads.test.ts` (6 tests)

| Test | Status |
|------|--------|
| Create a thread (with metadata and timestamps) | ✅ |
| Get thread by ID | ✅ |
| List threads with pagination metadata | ✅ |
| Update thread metadata | ✅ |
| Delete a thread (+ verify 404) | ✅ |
| 404 for non-existent thread | ✅ |

#### Messages — `messages.test.ts` (4 tests)

| Test | Status |
|------|--------|
| Save messages and verify content structure (content.parts shape) | ✅ |
| List messages with pagination metadata | ✅ |
| Preserve message content and roles across save/list | ✅ |
| Delete specific messages | ✅ |

#### Status & Working Memory — `status.test.ts` (4 tests)

| Test | Status |
|------|--------|
| Memory status endpoint | ✅ |
| Memory config with exact shape (workingMemory template) | ✅ |
| Working memory GET — null for fresh thread (+ source, threadExists, template) | ✅ |
| Working memory POST — update and retrieve (resourceId in body) | ✅ |

---

### Workspace (22 tests, 3 files)

#### Metadata — `metadata.test.ts` (3 tests)

| Test | Status |
|------|--------|
| List all workspaces with capabilities (hasFilesystem, hasSkills, readOnly) | ✅ |
| Get workspace details — status, filesystem provider, capabilities | ✅ |
| Non-existent workspace returns isWorkspaceConfigured: false | ✅ |

#### Filesystem — `filesystem.test.ts` (13 tests)

| Test | Status |
|------|--------|
| List root directory entries (file type, size, directory type) | ✅ |
| List subdirectory entries | ✅ |
| 404 for non-existent directory | ✅ |
| Read file content (exact content match) | ✅ |
| 404 for non-existent file | ✅ |
| Stat file metadata (type, size derived from fixture) | ✅ |
| Stat directory metadata | ✅ |
| 404 for non-existent stat path | ✅ |
| Write file and read back | ✅ |
| Write with recursive directory creation | ✅ |
| Create directory (+ verify via stat) | ✅ |
| Create nested directories with recursive | ✅ |
| Delete file (+ verify 404 after) | ✅ |
| Delete directory recursively (+ verify 404 after) | ✅ |
| 404 when deleting non-existent path | ✅ |

#### Skills — `skills.test.ts` (6 tests)

| Test | Status |
|------|--------|
| List discovered skills (name, description, path) | ✅ |
| Get skill details — instructions, source, references, scripts, assets | ✅ |
| 404 for non-existent skill | ✅ |
| List skill reference files | ✅ |
| Get reference file content (exact content match) | ✅ |
| 404 for non-existent reference | ✅ |

---

### Processors (17 tests, 1 file)

| Test | Status |
|------|--------|
| List all registered processors (shape, phases, isWorkflow) | ✅ |
| Get processor details by ID (phases, configurations) | ✅ |
| Get suffix processor — verify both input and outputResult phases | ✅ |
| 404 for non-existent processor | ✅ |
| Execute uppercase processor on input phase (exact text transform) | ✅ |
| Execute suffix processor on input phase (append suffix) | ✅ |
| Execute suffix processor on outputResult phase (append suffix) | ✅ |
| Process multiple messages at once (batch transform) | ✅ |
| Preserve non-text parts while transforming text parts (mixed part types) | ✅ |
| Trigger tripwire with metadata when message contains BLOCK | ✅ |
| Pass through when tripwire is not triggered | ✅ |
| Compose input and outputResult phases independently (chained execution) | ✅ |
| Handle empty messages array | ✅ |
| 400 when phase is missing | ✅ |
| 400 when messages is missing | ✅ |
| 400 for unsupported phase on processor | ✅ |
| 404 for non-existent processor (execute) | ✅ |

---

### Scores (11 tests, 1 file)

| Test | Status |
|------|--------|
| List registered scorers (config shape, isRegistered flag) | ✅ |
| Get scorer details by ID (config, isRegistered) | ✅ |
| Non-existent scorer returns null (200) | ✅ |
| Save a score record (scorerId, entityId, score, reason round-trip) | ✅ |
| Save a second score for the same run | ✅ |
| List scores by run ID (exact pagination total, both scorerIds present) | ✅ |
| Empty scores for unknown run | ✅ |
| List scores by scorer ID (exact pagination total, score value) | ✅ |
| Empty scores for unknown scorer | ✅ |
| List scores by entity (exact pagination total, all entityIds match) | ✅ |
| 404 for unknown entity | ✅ |

---

### Datasets (19 tests, 1 file)

| Test | Status |
|------|--------|
| Create a dataset (name, description, metadata, version 0) | ✅ |
| List datasets with pagination | ✅ |
| Get dataset by ID | ✅ |
| 404 for non-existent dataset | ✅ |
| Update dataset metadata (PATCH) | ✅ |
| Add item to dataset (input, groundTruth, metadata) | ✅ |
| Add a second item | ✅ |
| List items with exact pagination total | ✅ |
| Get item by ID | ✅ |
| Update item (PATCH groundTruth) | ✅ |
| SCD-2 item history after update (>= 2 versions) | ✅ |
| Get item at specific dataset version | ✅ |
| 404 for item at non-existent version | ✅ |
| Batch insert items (2 items, single version) | ✅ |
| Batch delete items (verify removal) | ✅ |
| Delete single item (verify absent from list) | ✅ |
| List dataset versions with shape assertions | ✅ |
| List experiments (empty initially) | ✅ |
| Delete dataset (+ verify 404 after) | ✅ |

---

## ⬜ What's Not Tested

### Vector Store — 🔒 Needs embedder + vector config

| Endpoint | Priority |
|----------|----------|
| `GET /vectors` — List vector stores | High |
| `GET /embedders` — List embedders | High |
| `POST /vector/:name/create-index` — Create vector index | High |
| `GET /vector/:name/indexes` — List indexes | High |
| `GET /vector/:name/indexes/:indexName` — Get index details | High |
| `POST /vector/:name/upsert` — Upsert vectors | High |
| `POST /vector/:name/query` — Query vectors | High |
| `DELETE /vector/:name/indexes/:indexName` — Delete index | High |

### Logs — 🔒 Needs logger transports

| Endpoint | Priority |
|----------|----------|
| `GET /logs/transports` — List log transports | Medium |
| `GET /logs` — List logs | Medium |
| `GET /logs/:runId` — Get logs for a run | Medium |

### Agents — Untested Endpoints

| Endpoint | Why | Priority |
|----------|-----|----------|
| `POST /agents/:agentId/generate-legacy` | Deprecated | Low |
| `POST /agents/:agentId/stream-legacy` | Deprecated | Low |
| `POST /agents/:agentId/clone` | Stored agent feature | Low |
| `POST /agents/:agentId/instructions/enhance` | Non-deterministic LLM output | Low |
| `POST /agents/:agentId/model` (update/get/reset) | Requires stored agents | Low |
| `GET /agents/:agentId/skills/:skillName` | Requires workspace/skills setup | Low |

### Observability — Untested Endpoints

| Endpoint | Priority |
|----------|----------|
| `POST /observability/traces/score` — Score a trace | Low |
| `POST /observability/metrics/*` — Aggregate, breakdown, timeseries, percentiles | Low |
| `GET /observability/discovery/*` — Metric names, labels, entity types | Low |

> Requires telemetry/tracing configuration.

### Memory — Untested Endpoints

| Endpoint | Priority |
|----------|----------|
| `POST /memory/threads/:threadId/clone` — Clone a thread | Medium |
| `GET /memory/search` — Semantic search across threads | Medium |
| `POST /memory/observational-memory` — Observational memory features | Low |
| `POST /memory/observational-memory/buffer-status` — Buffer status | Low |

> Requires `semanticRecall` and observational memory config + embedder.

### MCP — Untested Endpoints

| Endpoint | Priority |
|----------|----------|
| `POST /mcp/:serverId/messages` — SSE message forwarding | Low |
| MCP resources (list, read, subscribe) | Medium |
| MCP prompts (list, get) | Medium |

### Workspace — Untested Endpoints

| Endpoint | Priority |
|----------|----------|
| `GET /workspaces/:id/search` — Requires vector store + embedder | Low |
| `POST /workspaces/:id/index` — Requires vector store + embedder | Low |
| `GET /workspaces/:id/skills/search` — Requires search configuration | Low |
| `GET /workspaces/:id/skills-sh/*` (6 routes) — External skills.sh API proxy | Low |

### Dataset Experiments — 🔒 Needs async agent/scorer execution

| Endpoint | Priority |
|----------|----------|
| `POST /datasets/:datasetId/experiments` — Trigger experiment | Medium |
| `GET /datasets/:datasetId/experiments/:experimentId` — Get details | Medium |
| `GET /datasets/:datasetId/experiments/:experimentId/results` — List results | Medium |
| `POST /datasets/:datasetId/compare` — Compare experiments | Medium |

### Other Untested Areas

| Area | Endpoints | Requires | Priority |
|------|-----------|----------|----------|
| A2A Protocol | 2 routes | — | Medium |
| Processor Providers | 2 routes | Editor config | Low |
| Auth | 4 routes | Auth provider | Low |
| System | 1 route | — | Low |
| Stored Agents | 13 routes | EE license | Low |
| Stored Workspaces | 5 routes | EE license | Low |
| Stored Prompt Blocks | 12 routes | EE license | Low |
| Stored Scorers | 12 routes | EE license | Low |
| Stored Skills | 6 routes | EE license | Low |
| Stored MCP Clients | 12 routes | EE license | Low |

---

## Recommended Next Priorities

1. **Vector Store** — Core RAG primitive, 8 endpoints, requires embedder + vector config
2. **Logs** — 3 endpoints, minimal setup, validates telemetry plumbing
3. **Memory search + clone** — 2 endpoints, extends existing memory coverage
4. **A2A Protocol** — 2 endpoints, validates agent interoperability
5. **Dataset Experiments** — 4 endpoints, end-to-end eval pipeline
6. **MCP resources/prompts** — Extends MCP coverage with resource and prompt features
