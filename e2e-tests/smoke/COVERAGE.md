# Smoke Test Coverage

> 199 tests across 37 test files — last updated 2026-03-20

## What's Tested

### Workflows (73 tests, 17 files)

#### Basic Execution (`basic.test.ts` — 7 tests)
- [x] Sequential steps — chain 3 steps, produce combined message
- [x] Schema validation — valid input accepted
- [x] Schema validation — value too high rejected
- [x] Schema validation — wrong type rejected
- [x] Schema validation — boundary value 0 (minimum)
- [x] Schema validation — boundary value 100 (maximum)
- [x] Schema validation — below minimum rejected
- [x] Map between steps — fullName to displayName mapping

#### Control Flow (`control-flow.test.ts` — 9 tests)
- [x] Branch — positive branch for positive values
- [x] Branch — negative branch for negative values
- [x] Branch — boundary value 0 (positive per >= 0)
- [x] Parallel — 3 concurrent steps with collected results
- [x] Do-while — loop until count reaches 5
- [x] Do-while — executes at least once at threshold (do-while semantics)
- [x] Do-until — accumulate until total reaches 50
- [x] Do-until — executes at least once at threshold (do-until semantics)
- [x] Foreach — process each item in array

#### Suspend/Resume (`suspend-resume.test.ts` — 5 tests)
- [x] Basic suspend — returns suspend payload
- [x] Basic suspend — resume with data and complete
- [x] Basic suspend — handle rejection on resume
- [x] Parallel suspend — suspend both parallel branches
- [x] Parallel suspend — resume individual branches by step ID
- [x] Loop suspend — suspend on each loop iteration and resume
- [x] Loop suspend — execute once and stop at threshold

#### State Management (`state.test.ts` — 2 tests)
- [x] Stateful workflow — accumulate state across steps
- [x] Initial state — start with provided initialState

#### State + Suspend (`state-suspend.test.ts` — 4 tests)
- [x] State persist across suspend/resume cycle
- [x] State persist across suspend/resume with rejection
- [x] State accumulation inside do-while loop
- [x] State access in parallel branches

#### Nested Workflows (`nested.test.ts` — 1 test, `nested-advanced.test.ts` — 2 tests)
- [x] Inner workflow as a step — pass data through
- [x] Deep nesting — 2 levels of nesting
- [x] Nested suspend — suspend inside nested workflow and resume

#### Error Handling (`error-handling.test.ts` — 2 tests)
- [x] Retry workflow — succeed after retries
- [x] Failure workflow — report failed status with exact error shape

#### Foreach Errors (`foreach-errors.test.ts` — 3 tests)
- [x] Foreach item throws — workflow fails with exact error
- [x] Foreach no items throw — workflow succeeds
- [x] Foreach flaky item with retry — succeeds after retries

#### Sleep (`sleep.test.ts` — 1 test)
- [x] 2s sleep completes and reports elapsed time within bounds

#### Streaming (`streaming.test.ts` — 2 tests, `streaming-advanced.test.ts` — 3 tests)
- [x] Stream sequential-steps with proper chunk types
- [x] Stream suspend then stream resume with proper events
- [x] Stream failed workflow with error event and step-level error
- [x] Stream workflow that retries and eventually succeeds
- [x] Stream parallel suspend events for multiple branches + resume both

#### Concurrent Suspend (`concurrent-suspend.test.ts` — 2 tests)
- [x] Resume both parallel branches simultaneously
- [x] Independent suspend/resume across concurrent runs

#### Cancel (`cancel-suspended.test.ts` — 2 tests)
- [x] Cancel a workflow in suspended state
- [x] Not resumable after cancellation

#### Run Management (`run-management.test.ts` — 7 tests)
- [x] List all registered workflows
- [x] Get single workflow metadata
- [x] List runs after starting a workflow (with snapshot shape)
- [x] Get run details by ID
- [x] Delete a run (+ verify 404)
- [x] Cancel a running workflow (via poll + cancel)
- [x] Time-travel — re-execute from a specific step
- [x] Restart an active workflow run

#### API Endpoint Variants (`api-endpoints.test.ts` — 4 tests)
- [x] Sync /start (fire-and-forget) + poll for completion
- [x] Sync /resume (fire-and-forget) + poll for completion
- [x] /create-run — pre-create and verify
- [x] /time-travel-stream — stream time-travel re-execution

#### Edge Cases (`edge-cases.test.ts` — 5 tests)
- [x] 404 for non-existent workflow
- [x] 404 for non-existent run
- [x] 404 for non-existent workflow metadata
- [x] 500 when resuming a completed (non-suspended) run
- [x] 500 when time-traveling to non-existent step
- [x] Foreach with empty array
- [x] Foreach with single item
- [x] Multiple concurrent runs of the same workflow

---

### Tools (15 tests, 1 file)

#### Discovery (`tools.test.ts`)
- [x] List all registered tools (verify by tool ID)
- [x] Get tool by ID with schema (inputSchema, outputSchema via superjson)
- [x] 404 for non-existent tool

#### Execution (`tools.test.ts`)
- [x] Calculator — addition (10 + 32 = 42)
- [x] Calculator — multiplication (7 × 6 = 42)
- [x] Calculator — subtraction (100 − 58 = 42)
- [x] Calculator — division (84 ÷ 2 = 42)
- [x] String-transform — uppercase
- [x] String-transform — reverse
- [x] String-transform — length
- [x] Timestamp — no input, returns timestamp + ISO string
- [x] 500 when executing tool that throws
- [x] 500 when dividing by zero
- [x] Validation error for missing required fields (200 with error shape)
- [x] 404 when executing non-existent tool

---

### Agents (26 tests, 8 files)

#### Discovery (`agents.test.ts` — 4 tests)
- [x] List all registered agents
- [x] Get agent metadata by ID (name, instructions, source, description)
- [x] Agent tools included in metadata (keys, ids, descriptions)
- [x] 404 for non-existent agent

#### Generate (`generate.test.ts` — 6 tests)
- [x] Simple text generation (response text, finishReason)
- [x] Usage information (inputTokens, outputTokens)
- [x] Tool use — calculator (multiply 7×6, verify tool result = 42)
- [x] Tool use — string-transform (uppercase, verify exact result)
- [x] Multi-turn with memory — recall fact across thread turns
- [x] 404 for non-existent agent

#### Stream (`stream.test.ts` — 3 tests)
- [x] Text streaming — event sequence (start → text-delta → step-finish → finish), usage info
- [x] Tool use streaming — tool-call + tool-result events with exact result
- [x] 404 for non-existent agent

#### Structured Output (`structured-output.test.ts` — 2 tests)
- [x] Generate with structuredOutput — JSON response matching schema (name, capital, population)
- [x] Stream with structuredOutput — text deltas form valid structured JSON

#### Stream with Memory (`stream-memory.test.ts` — 1 test)
- [x] Multi-turn recall across thread turns via stream endpoint

#### Tool Approval (`tool-approval.test.ts` — 2 tests)
- [x] Approve tool call — pause on tool-call-approval, resume after approval with tool result
- [x] Decline tool call — pause on tool-call-approval, resume after decline with rejection message

#### Providers (`providers.test.ts` — 2 tests)
- [x] List available providers with expected shape (id, name, connected)
- [x] OpenAI listed as a connected provider

#### Agent-Scoped Tools (`agent-tools.test.ts` — 6 tests)
- [x] Get calculator tool metadata through agent endpoint
- [x] Get string-transform tool metadata through agent endpoint
- [x] 404 for tool not assigned to agent (always-fails)
- [x] Execute calculator through agent endpoint (exact result)
- [x] Execute string-transform through agent endpoint (exact result)
- [x] 404 when executing tool not assigned to agent

---

### MCP (17 tests, 2 files)

#### REST API (`rest.test.ts` — 11 tests)
- [x] List registered MCP servers (name, version, is_latest)
- [x] Get server details by ID
- [x] 404 for non-existent server
- [x] List tools on MCP server (calculator, string-transform)
- [x] Get tool details with input schema
- [x] 404 for non-existent tool on valid server
- [x] 404 for tool on non-existent server
- [x] Execute calculator via MCP REST endpoint (exact result)
- [x] Execute string-transform via MCP REST endpoint (exact result)
- [x] 500 when executing non-existent tool
- [x] Validation error for missing required fields (200 with error shape)

#### Client Transport (`client.test.ts` — 6 tests)
- [x] Connect and list tools via Streamable HTTP transport
- [x] Execute calculator tool via Streamable HTTP
- [x] Execute string-transform tool via Streamable HTTP
- [x] Connect and list tools via SSE fallback transport
- [x] Execute calculator tool via SSE transport
- [x] Execute string-transform tool via SSE transport

---

### Observability (7 tests, 1 file)

#### Traces (`traces.test.ts` — 7 tests)
- [x] List spans with pagination (total, page, perPage, hasMore)
- [x] Span shape — traceId (hex32), spanId (hex16), name, spanType, startedAt
- [x] Workflow spans present — entityType, entityId, name pattern
- [x] Successful workflow spans with timing (startedAt ≤ endedAt)
- [x] Pagination — page 0 and page 1 return distinct spans
- [x] Get trace by ID — all spans share traceId, span shape verified
- [x] 404 for non-existent trace

---

### Memory (14 tests, 3 files)

#### Threads (`threads.test.ts` — 6 tests)
- [x] Create a thread (with metadata and timestamps)
- [x] Get thread by ID
- [x] List threads with pagination metadata
- [x] Update thread metadata
- [x] Delete a thread (+ verify 404)
- [x] 404 for non-existent thread

#### Messages (`messages.test.ts` — 4 tests)
- [x] Save messages and verify content structure (content.parts shape)
- [x] List messages with pagination metadata
- [x] Preserve message content and roles across save/list
- [x] Delete specific messages

#### Status & Working Memory (`status.test.ts` — 4 tests)
- [x] Memory status endpoint
- [x] Memory config with exact shape (workingMemory template)
- [x] Working memory GET — null for fresh thread (+ source, threadExists, template)
- [x] Working memory POST — update and retrieve (resourceId in body)

---

### Workspace (22 tests, 3 files)

#### Metadata (`metadata.test.ts` — 3 tests)
- [x] List all workspaces with capabilities (hasFilesystem, hasSkills, readOnly)
- [x] Get workspace details — status, filesystem provider, capabilities
- [x] Non-existent workspace returns isWorkspaceConfigured: false

#### Filesystem (`filesystem.test.ts` — 13 tests)
- [x] List root directory entries (file type, size, directory type)
- [x] List subdirectory entries
- [x] 404 for non-existent directory
- [x] Read file content (exact content match)
- [x] 404 for non-existent file
- [x] Stat file metadata (type, size derived from fixture)
- [x] Stat directory metadata
- [x] 404 for non-existent stat path
- [x] Write file and read back
- [x] Write with recursive directory creation
- [x] Create directory (+ verify via stat)
- [x] Create nested directories with recursive
- [x] Delete file (+ verify 404 after)
- [x] Delete directory recursively (+ verify 404 after)
- [x] 404 when deleting non-existent path

#### Skills (`skills.test.ts` — 6 tests)
- [x] List discovered skills (name, description, path)
- [x] Get skill details — instructions, source, references, scripts, assets
- [x] 404 for non-existent skill
- [x] List skill reference files
- [x] Get reference file content (exact content match)
- [x] 404 for non-existent reference

---

### Processors (17 tests, 1 file)

#### Processors (`processors.test.ts` — 17 tests)
- [x] List all registered processors (shape, phases, isWorkflow)
- [x] Get processor details by ID (phases, configurations)
- [x] Get suffix processor — verify both input and outputResult phases
- [x] 404 for non-existent processor
- [x] Execute uppercase processor on input phase (exact text transform)
- [x] Execute suffix processor on input phase (append suffix)
- [x] Execute suffix processor on outputResult phase (append suffix)
- [x] Process multiple messages at once (batch transform)
- [x] Preserve non-text parts while transforming text parts (mixed part types)
- [x] Trigger tripwire with metadata when message contains BLOCK
- [x] Pass through when tripwire is not triggered
- [x] Compose input and outputResult phases independently (chained execution)
- [x] Handle empty messages array
- [x] 400 when phase is missing
- [x] 400 when messages is missing
- [x] 400 for unsupported phase on processor
- [x] 404 for non-existent processor (execute)

---

### Scores (11 tests, 1 file)

#### Scores (`scores.test.ts` — 11 tests)
- [x] List registered scorers (config shape, isRegistered flag)
- [x] Get scorer details by ID (config, isRegistered)
- [x] Non-existent scorer returns null (200)
- [x] Save a score record (scorerId, entityId, score, reason round-trip)
- [x] Save a second score for the same run
- [x] List scores by run ID (exact pagination total, both scorerIds present)
- [x] Empty scores for unknown run
- [x] List scores by scorer ID (exact pagination total, score value)
- [x] Empty scores for unknown scorer
- [x] List scores by entity (exact pagination total, all entityIds match)
- [x] 404 for unknown entity

---

## What's NOT Tested

### Agents — Untested Endpoints

| Endpoint | Why Not Tested | Priority |
|----------|---------------|----------|
| `POST /agents/:agentId/generate-legacy` | Deprecated endpoint | Low |
| `POST /agents/:agentId/stream-legacy` | Deprecated endpoint | Low |
| `POST /agents/:agentId/clone` | Stored agent feature | Low |
| `POST /agents/:agentId/instructions/enhance` | Requires LLM, non-deterministic output | Low |
| `POST /agents/:agentId/model` (update/get/reset) | Model management, requires stored agents | Low |
| `GET /agents/:agentId/skills/:skillName` | Requires workspace/skills setup | Low |

### Vector Store (0 coverage)

| Endpoint | Notes | Priority |
|----------|-------|----------|
| `GET /vectors` | List vector stores | High |
| `GET /embedders` | List embedders | High |
| `POST /vector/:name/create-index` | Create vector index | High |
| `GET /vector/:name/indexes` | List indexes | High |
| `GET /vector/:name/indexes/:indexName` | Get index details | High |
| `POST /vector/:name/upsert` | Upsert vectors | High |
| `POST /vector/:name/query` | Query vectors | High |
| `DELETE /vector/:name/indexes/:indexName` | Delete index | High |

**Requires:** Embedder config (e.g., `@mastra/openai`) + vector store (LibSQL or PG).

### Logs (0 coverage)

| Endpoint | Notes | Priority |
|----------|-------|----------|
| `GET /logs/transports` | List log transports | Medium |
| `GET /logs` | List logs | Medium |
| `GET /logs/:runId` | Get logs for a run | Medium |

**Requires:** Logger with transports configured.

### Observability — Untested Endpoints

| Endpoint | Notes | Priority |
|----------|-------|----------|
| `POST /observability/traces/score` | Score a trace | Low |
| `POST /observability/metrics/*` | Aggregate, breakdown, timeseries, percentiles | Low |
| `GET /observability/discovery/*` | Metric names, labels, entity types, etc. | Low |

**Requires:** Telemetry/tracing configuration.

### Memory — Untested Endpoints

| Endpoint | Notes | Priority |
|----------|-------|----------|
| `POST /memory/threads/:threadId/clone` | Clone a thread | Medium |
| `GET /memory/search` | Semantic search across threads | Medium |
| `POST /memory/observational-memory` | Observational memory features | Low |
| `POST /memory/observational-memory/buffer-status` | Buffer status | Low |

**Requires:** `semanticRecall` and observational memory config + embedder.

### System (0 coverage)

| Endpoint | Notes | Priority |
|----------|-------|----------|
| `GET /system/packages` | Installed package info | Low |

### MCP — Untested Endpoints

| Endpoint | Notes | Priority |
|----------|-------|----------|
| `POST /mcp/:serverId/messages` | SSE message forwarding | Low |
| MCP resources (list, read, subscribe) | Requires resource configuration | Medium |
| MCP prompts (list, get) | Requires prompt configuration | Medium |

### Auth (0 coverage)

| Endpoint | Notes | Priority |
|----------|-------|----------|
| `POST /auth/credentials/sign-up` | User registration | Low |
| `POST /auth/credentials/sign-in` | User login | Low |
| `GET /auth/me` | Current user info | Low |
| `GET /auth/capabilities` | Auth capabilities | Low |

**Requires:** Auth provider configuration.

### Stored Entities (0 coverage)

| Category | Endpoints | Notes | Priority |
|----------|-----------|-------|----------|
| Stored Agents | 13 routes | CRUD + versioning | Low |
| Stored Workspaces | 5 routes | CRUD | Low |
| Stored Prompt Blocks | 12 routes | CRUD + versioning | Low |
| Stored Scorers | 12 routes | CRUD + versioning | Low |
| Stored Skills | 6 routes | CRUD + publish | Low |
| Stored MCP Clients | 12 routes | CRUD + versioning | Low |

**Requires:** EE license / stored entity infrastructure.

### Workspace — Untested Endpoints

| Endpoint | Notes | Priority |
|----------|-------|----------|
| `GET /workspaces/:id/search` | Requires vector store + embedder | Low |
| `POST /workspaces/:id/index` | Requires vector store + embedder | Low |
| `GET /workspaces/:id/skills/search` | Requires search configuration | Low |
| `GET /workspaces/:id/skills-sh/*` (6 routes) | External skills.sh API proxy | Low |

**Requires:** Vector store + embedder for search; external API for skills.sh.

### Datasets (0 coverage)

| Category | Endpoints | Notes | Priority |
|----------|-----------|-------|----------|
| Dataset CRUD | 5 routes | Create, list, get, update, delete | Low |
| Dataset Items | 6 routes | Add, batch, update, delete items | Low |
| Experiments | 4 routes | Trigger, compare | Low |

### A2A Protocol (0 coverage)

| Endpoint | Notes | Priority |
|----------|-------|----------|
| `GET /.well-known/:agentId/agent-card.json` | Agent discovery card | Medium |
| `POST /a2a/:agentId` | Agent execution | Medium |

### Processor Providers (0 coverage)

| Endpoint | Notes | Priority |
|----------|-------|----------|
| `GET /processor-providers` | List processor providers | Low |
| `GET /processor-providers/:providerId` | Get provider with config schema | Low |

**Requires:** Editor configuration (`mastra.getEditor()`).

### Stored Scorers (0 coverage)

| Endpoint | Notes | Priority |
|----------|-------|----------|
| `GET/POST/PATCH/DELETE /stored/scorers` | CRUD for stored scorer definitions | Low |
| `GET/POST/DELETE /stored/scorers/:id/versions` | Scorer version management | Low |

**Requires:** EE license / stored entity infrastructure.

---

## Recommended Next Priorities

1. **Vector Store** — Core RAG primitive, 8 endpoints, requires embedder + vector config
2. **Logs** — 3 endpoints, minimal setup, validates telemetry plumbing
3. **Memory search + clone** — 2 endpoints, extends existing memory coverage
4. **Agent structured output** — Uses existing agent, adds schema-based output verification
5. **A2A Protocol** — 2 endpoints, validates agent interoperability
6. **MCP resources/prompts** — Extends MCP coverage with resource and prompt features
