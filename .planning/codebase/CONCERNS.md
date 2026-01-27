# Codebase Concerns

**Analysis Date:** 2026-01-27

## Tech Debt

**Hardcoded Mapping in Codemod**
- Issue: Codemod v1 imports are hardcoded with a TODO to generate from package exports
- Files: `packages/codemod/src/codemods/v1/mastra-core-imports.ts`
- Impact: Maintenance burden when exports change; manual synchronization required
- Fix approach: Implement automatic export generation from package metadata at build time

**Deprecated Fields in CloudflareDeployer**
- Issue: Multiple deprecated configuration fields (projectName, workerNamespace, d1Databases, kvNamespaces) still supported with warnings
- Files: `deployers/cloudflare/src/index.ts`
- Impact: Configuration complexity, increased testing surface, potential for user confusion
- Fix approach: Plan deprecation timeline and remove in next major version (already marked with TODO)

**Missing Session Handle Support in Gemini Live API**
- Issue: Session resumption not supported; returns undefined instead of actual session handle
- Files: `voice/google-gemini-live-api/src/index.ts` (line 1050)
- Impact: Cannot resume conversations across sessions; session state is lost
- Fix approach: Implement session persistence when Gemini Live API adds support

**Missing Session Config in Session Manager**
- Issue: Session config and context size tracking are undefined (TODO markers present)
- Files: `voice/google-gemini-live-api/src/managers/SessionManager.ts` (lines 171-172)
- Impact: No session configuration persistence; limited session diagnostics
- Fix approach: Add session config structure and tracking once API supports it

**Type Errors in Workflow Builders (z.enum().optional().default())**
- Issue: Multiple @ts-expect-error suppressions for z.enum().optional().default() type errors
- Files:
  - `templates/template-flash-cards-from-pdf/src/mastra/workflows/flash-cards-generation-workflow.ts` (line 248)
  - `templates/template-pdf-to-audio/src/mastra/workflows/pdf-to-audio-workflow.ts` (line 125)
  - `templates/template-ad-copy-from-content/src/mastra/workflows/ad-copy-generation-workflow.ts` (lines 336, 425)
- Impact: Type safety compromised; future Zod updates may break code
- Fix approach: Either upgrade Zod version or refactor schema patterns to avoid type clash

**Type Mismatch in Playground UI**
- Issue: ThreadMessageLike type missing "data" property from role, multiple @ts-expect-error suppressions
- Files: `packages/playground-ui/src/services/mastra-runtime-provider.tsx` (lines 38, 55, 77)
- Impact: Type safety gaps; potential runtime errors with message data access
- Fix approach: Extend ThreadMessageLike type to include all required properties from role variants

**Hardcoded Memory Config Listing (TODO)**
- Issue: Agent form does not implement proper memory config listing
- Files: `packages/playground-ui/src/domains/agents/components/create-agent/agent-form.tsx` (line 157)
- Impact: Users cannot see or select memory configurations in UI
- Fix approach: Implement memory config enumeration from agent instance

**Unimplemented Advanced Strategies in Agent Builder**
- Issue: Advanced strategy selection disabled with TODO; marked as blocked on user feedback
- Files: `packages/agent-builder/src/workflows/template-builder/template-builder.ts` (line 1810)
- Impact: Limited strategy options; users cannot access advanced agent configuration
- Fix approach: Implement remaining strategies after collecting user feedback

**Missing Tools Tracing Context (Server)**
- Issue: Tool execution in server handlers passes no tracing context (TODO placeholders)
- Files:
  - `packages/server/src/server/handlers/tools.ts` (lines 142, 235)
  - `packages/server/src/server/handlers/agents.ts` (line 579)
- Impact: Tool calls not traced in distributed tracing; observability gap
- Fix approach: Propagate tracing context from request to tool execution layer

**Missing Logger Propagation in Network Loop**
- Issue: Agent logger not passed through network loop execution (5 TODO instances)
- Files: `packages/core/src/loop/network/index.ts` (lines 600, 877, 897, 1137, 1168, 1424)
- Impact: Tool execution and streaming lacks agent-specific logging context
- Fix approach: Pass logger instance through execution context in network loop

**Incomplete Streaming in Evented Workflows**
- Issue: Stream support marked as TODO in evented workflow methods
- Files: `packages/core/src/workflows/evented/workflow.ts` (lines 333, 344, 1315)
- Impact: Streaming not available for evented workflows; feature parity issue
- Fix approach: Implement streaming path for event-driven workflow execution

**Unimplemented State Management in Evented Workflows**
- Issue: Multiple state management TODOs and test mocks (RequestContext, EventEmitter mocked)
- Files: `packages/core/src/workflows/evented/workflow-event-processor/` (multiple files with TODO for state)
- Impact: Event-driven workflows have incomplete state tracking; potential data loss
- Fix approach: Implement proper state persistence and restoration for suspended events

**Incomplete Parallel Step Resume Handling**
- Issue: Parallel steps that partially suspend have incomplete state management
- Files: `packages/core/src/workflows/handlers/entry.ts` (lines 229, 244)
- Impact: Multi-path suspended workflows may not resume correctly
- Fix approach: Complete state tracking for multi-suspended scenarios

---

## Known Bugs

**Message Ordering Issue #9909**
- Symptoms: Text parts appear after tool calls in recalled messages; inconsistent ordering between stream, storage, and recall
- Files: `packages/memory/integration-tests/src/shared/message-ordering.ts` (comprehensive test suite)
- Trigger: Stream messages with interleaved text and tool calls; retrieval via semantic recall
- Workaround: None documented; issue requires core message persistence fix
- Root cause: Message part ordering not preserved through save/recall cycle

**Tool Arguments Empty in Gemini Live API - Issue #10161**
- Symptoms: Tool calls execute but arguments are always empty
- Files: `voice/google-gemini-live-api/src/tool-args-bug.test.ts`
- Trigger: Tool calls from Gemini Live API
- Workaround: None; blocks voice integration features
- Impact: Cannot use parameterized tools with voice input

**v1 Message ID Collisions**
- Symptoms: Messages with same ID replace each other instead of coexisting
- Files: `packages/core/src/agent/message-list/tests/message-list.test.ts` (line 3333)
- Trigger: Memory processor flow with duplicate message IDs
- Impact: Message loss in long conversations; data integrity issue
- Root cause: ID collision detection not implemented

**Metadata Not Present in Output Result**
- Symptoms: Metadata added by processOutputResult not available in final output
- Files: `packages/core/src/agent/agent-stream-processor.test.ts` (line 228)
- Trigger: Stream processing with output processors
- Impact: Custom metadata lost during processing; observability degradation

**Metadata Not Accessible in UIMessages**
- Symptoms: Metadata added by processOutputResult not accessible in uiMessages
- Files: `packages/core/src/agent/agent-stream-processor.test.ts` (line 266)
- Trigger: Access to uiMessages after stream processing
- Impact: Metadata unavailable to UI layer; feature gap

**JSON Parsing Error in AIv5 Transform**
- Symptoms: "Unterminated string in JSON" error thrown
- Files: `packages/core/src/stream/aisdk/v5/transform.test.ts` (line 35)
- Trigger: Partial JSON chunk validation in streaming
- Impact: Streaming fails on valid partial chunks; feature unusable

**Flakey Parallel/Suspend/Resume Test**
- Symptoms: Test intermittently fails; marked as blocking PR merges
- Files: `packages/core/src/agent/agent.test.ts` (line 6175)
- Trigger: Parallel step resumption with suspend
- Impact: Cannot reliably test suspend/resume; blocks feature development
- Root cause: Race condition in parallel execution or state restoration

**Malformed Tool Detection Bug**
- Symptoms: scanFolderFactory used without arguments (should be called with path)
- Files: `packages/core/src/tools/__tests__/malformed-tool.test.ts` (line 33)
- Trigger: Tool scan with folder factory
- Impact: Tool discovery fails silently; tools not loaded
- Fix: Change `scanFolderFactory` to `scanFolderFactory('/some/path')`

**Model Router Error Handling**
- Symptoms: Console warnings about missing API keys; tests fail silently
- Files: `packages/core/src/llm/model/router.integration.test.ts` (lines 54-58)
- Trigger: No provider API keys configured
- Impact: Integration test failures not immediately obvious
- Fix: Implement proper test skip/error reporting

**Vector Store Deletion Not Implemented**
- Symptoms: Messages deleted from storage not removed from vector stores
- Files:
  - `packages/memory/src/index.ts` (line 1195)
  - `stores/upstash/src/storage/domains/memory/index.ts` (line 1138)
  - `stores/mssql/src/storage/domains/memory/index.ts` (line 1088)
- Impact: Stale embeddings remain in vector stores; semantic search returns deleted content
- Fix approach: Implement cascade delete from memory storage to associated vector embeddings

---

## Security Considerations

**Shell Command Execution Risks**
- Risk: `createRunCommandTool` and network loop `run-command-tool` execute arbitrary shell commands
- Files:
  - `packages/core/src/loop/server.ts` (lines 11-12)
  - `packages/core/src/loop/network/run-command-tool.ts` (lines 6, 148)
- Current mitigation: Whitelist filtering available; restriction configuration required
- Recommendations:
  - Ensure default deny-all command policy
  - Document security implications prominently
  - Add rate limiting for command execution
  - Implement audit logging for all executed commands
  - Restrict to trusted agents only

**Token Exposure in Headers**
- Risk: Rate-limit tokens exposed in HTTP response headers
- Files:
  - `packages/core/src/llm/model/model.ts` (line 238)
  - `packages/core/src/llm/model/model.loop.ts` (line 280)
- Current mitigation: Tokens parsed for metrics only; not logged by default
- Recommendations: Ensure token values are never logged or exposed in error messages

**API Key Configuration Handling**
- Risk: API keys configured via environment variables or RequestContext
- Files: `packages/core/src/llm/model/resolve-model.test.ts` (lines 81-185)
- Current mitigation: No sensitive data serialization in logs
- Recommendations:
  - Audit all error messages that might include API keys
  - Implement credential masking in all logging
  - Use RequestContext-based secrets management consistently

**Node-Forge Dependency**
- Risk: node-forge (1.3.2) is pinned in package.json but is legacy crypto library
- Impact: Potential vulnerability if not kept updated with security patches
- Recommendations: Monitor for updates and CVEs; consider migration to native Node.js crypto

**Cookie and Dependency Vulnerabilities**
- Risk: Multiple dependencies with known vulnerabilities pinned in resolutions
- Files: `package.json` (resolutions section)
- Current mitigations: cookie >=0.7.2, tmp >=0.2.5, jsondiffpatch >=0.7.3, ssri >=6.0.2, jws ^4.0.1
- Recommendations: Monitor GitHub security advisories; update quarterly

---

## Performance Bottlenecks

**Large Test Files Indicate Complexity**
- Problem: Multiple test files exceed 20KB (likely slow to run)
- Files:
  - `packages/core/src/workflows/workflow.test.ts` (21,573 lines)
  - `packages/core/src/workflows/evented/evented-workflow.test.ts` (12,312 lines)
  - `packages/core/src/agent/agent.test.ts` (7,495 lines)
- Impact: Test suite slow; single-threaded test execution bottleneck
- Improvement path:
  - Split large test files into feature-specific modules
  - Run tests in parallel with vitest workers
  - Consider moving integration tests to separate CI job

**Memory Processor Semantic Recall Complexity**
- Problem: Semantic recall requires vector query + message filtering on every recall
- Files: `packages/memory/src/index.ts` (semantic recall implementation)
- Impact: High latency for conversation history with many messages
- Improvement path:
  - Add caching layer for recent recalls
  - Implement pagination for vector results
  - Profile hot paths with tracing

**Type Detection Overhead**
- Problem: TypeDetector performs sequential format checks on every message
- Files: `packages/core/src/agent/message-list/detection/TypeDetector.ts`
- Impact: Redundant checks for message format; O(n) per message
- Improvement path:
  - Cache detection results for message batch
  - Implement format hint passing to reduce checks

---

## Fragile Areas

**Workflow Parallel Block State Management**
- Files: `packages/core/src/workflows/handlers/entry.ts`, `packages/core/src/workflows/workflow.ts`
- Why fragile: Complex state tracking when multiple parallel steps suspend; edge case handling scattered
- Safe modification: Add comprehensive test coverage for suspend/resume in parallel blocks before touching
- Test coverage: Gaps in multi-suspend scenarios (#6418 partially addresses)

**Message List Type Detection**
- Files: `packages/core/src/agent/message-list/detection/TypeDetector.ts`
- Why fragile: Overlapping type checks across 5+ message formats; detection order critical
- Safe modification: Add explicit type guards and document format detection order
- Test coverage: Comprehensive but type intersection cases undercovered

**Memory Processor Vector Sync**
- Files: `packages/memory/src/index.ts` (updateMessages + semantic recall)
- Why fragile: Message updates must stay in sync with vector store; deletion path incomplete
- Safe modification: Add integration tests for vector sync before modifying persistence layer
- Test coverage: Gaps in message deletion → vector cleanup

**Evented Workflow Event Processing**
- Files: `packages/core/src/workflows/evented/workflow-event-processor/`
- Why fragile: Event-based execution with incomplete state management; many TODO markers
- Safe modification: Complete state implementation before adding new event handlers
- Test coverage: Partial mock state makes tests unreliable

**Agent Network Loop Tool Execution**
- Files: `packages/core/src/loop/network/index.ts`
- Why fragile: Logger and context passing incomplete; scattered execution paths
- Safe modification: Refactor to inject context/logger at entry point before tool loop
- Test coverage: Limited coverage for logger propagation scenarios

**Gemini Live Voice Integration**
- Files: `voice/google-gemini-live-api/src/`
- Why fragile: Known bugs (#10161); session state incomplete; many TODO markers
- Safe modification: Do not modify until bugs are fixed and API matures
- Test coverage: Failing tests; tool args bug unresolved

**Schema Compatibility Layer**
- Files: `packages/core/src/stream/aisdk/v5/transform.test.ts`
- Why fragile: JSON parsing errors on partial chunks; type safety bypassed
- Safe modification: Add comprehensive fuzzing tests for chunk boundaries
- Test coverage: Edge cases with truncated JSON undercovered

---

## Scaling Limits

**Monorepo Build Times**
- Current capacity: pnpm build from root takes ~2-3 minutes (estimated)
- Limit: Single-threaded builds; turbo caching only helps after first build
- Scaling path:
  - Implement incremental builds with change detection
  - Use turbo.json optimal settings for parallel builds
  - Cache build artifacts in CI pipeline

**Test Suite Runtime**
- Current capacity: Full monorepo test suite very slow (requires manual filtering)
- Limit: Cannot run full suite in PR checks without 15+ minute timeout
- Scaling path:
  - Split integration tests into separate CI job
  - Run unit tests in parallel on multiple workers
  - Use test sharding across CI matrix

**Memory Integration Tests**
- Current capacity: Requires Docker services; integration tests slow
- Limit: `pnpm dev:services:up` dependency blocks test parallelization
- Scaling path:
  - Container-per-test isolation
  - Test service pooling for resource efficiency

**Vector Search Scaling**
- Current capacity: Semantic recall works for typical conversation history
- Limit: No pagination in vector search results; full embedding comparison on every recall
- Scaling path:
  - Implement result limiting with continuation tokens
  - Add indexing strategy for vector store queries
  - Profile with large knowledge base sizes (10K+ vectors)

---

## Dependencies at Risk

**Zod Version Conflicts**
- Risk: Multiple Zod v3 and v4 branches coexist; schema compatibility issues
- Impact: Type inference failures; z.enum().optional().default() breaks
- Migration plan:
  - Standardize on Zod v4 for core
  - Maintain v3 compatibility layer for users
  - Update schema-compat package for cross-version support

**AI SDK Integration Fragility**
- Risk: Internal AI SDK versions (@internal/ai-sdk-v4, @internal/ai-sdk-v5) pinned; breaking changes upstream
- Impact: Message format changes break type detection; new model providers not supported
- Migration plan:
  - Monitor AI SDK releases closely
  - Implement adapter pattern for format changes
  - Consider vendoring critical components

**Google Gemini Live API Immaturity**
- Risk: API marked as unstable (many TODOs); session management incomplete
- Impact: Session handling broken; tool args bug (#10161); feature gaps
- Migration plan:
  - Wait for API stabilization (track GitHub issues)
  - Consider fallback to standard Gemini API
  - Do not rely on voice integration for production use

**Wrangler Unstable API**
- Risk: Unstable_RawConfig used; Cloudflare config API may change
- Impact: Deployer breaks with wrangler updates
- Migration plan:
  - Pin wrangler version in peer dependencies
  - Monitor wrangler changelog for API changes
  - Plan migration to stable config API when available

**OpenTelemetry Integration Complexity**
- Risk: Manual span instrumentation scattered; observer/exporter pattern emerging
- Impact: Tracing context missing in some paths (tools, network loop)
- Migration plan:
  - Implement auto-instrumentation via context propagation
  - Consolidate span creation in fewer places
  - Use OpenTelemetry SDK's context API consistently

---

## Missing Critical Features

**Session Resumption for Voice**
- Problem: No way to resume voice conversations; session state lost between calls
- Blocks: Production voice chat applications; conversational continuity impossible
- Workaround: None; users must start new conversation each time
- Priority: High (blocks voice product usage)

**Tool Argument Passing in Voice (Gemini)**
- Problem: Tool calls have empty arguments
- Blocks: Parameterized tools via voice input; feature completely broken
- Workaround: None; render tool calls non-functional
- Priority: Critical (issue #10161)

**Vector Store Cascade Delete**
- Problem: No cleanup when messages deleted
- Blocks: Long-running applications accumulate stale embeddings
- Workaround: Manual vector store cleanup; not scalable
- Priority: High (data integrity issue)

**Memory Config UI Selection**
- Problem: Cannot select memory configuration in playground
- Blocks: Users cannot configure memory processors
- Workaround: Manual config file editing
- Priority: Medium (affects UX only)

**Full Stream Support in Evented Workflows**
- Problem: Evented workflows don't support streaming
- Blocks: Real-time response generation with event-driven patterns
- Workaround: Use default workflows instead
- Priority: Medium (feature parity issue)

---

## Test Coverage Gaps

**Parallel Workflow Suspend/Resume Edge Cases**
- What's not tested: Multiple parallel steps suspending; resuming subsets; complex paths
- Files: `packages/core/src/workflows/workflow.test.ts`
- Risk: Silent failures in rare scenarios; flaky PR tests (#6175)
- Priority: High (blocks workflow feature stability)

**Message Ordering in All Storage Backends**
- What's not tested: Vector store consistency across all backends (only libsql covered)
- Files: `packages/memory/integration-tests/src/shared/message-ordering.ts`
- Risk: Issue #9909 may only be discovered in production with different storage
- Priority: High (affects data integrity)

**Evented Workflow State Transitions**
- What's not tested: Full state machine coverage for event-driven execution
- Files: `packages/core/src/workflows/evented/`
- Risk: Incomplete state handling causes silent failures
- Priority: Medium (feature still in development)

**Tool Execution Error Paths in Network Loop**
- What's not tested: Tool failure scenarios; exception propagation; retry logic
- Files: `packages/core/src/loop/network/`
- Risk: Tool errors not properly surfaced; debugging difficult
- Priority: Medium (production reliability)

**Streaming Chunk Boundary Handling**
- What's not tested: Partial JSON at buffer boundaries; truncated objects
- Files: `packages/core/src/stream/aisdk/v5/transform.test.ts`
- Risk: Stream failures on real-world chunk boundaries
- Priority: High (production stability)

**Memory Processor Filter Output**
- What's not tested: Processor that filters tool calls from memory
- Files: `packages/memory/integration-tests/src/` (weather agent with memory processor)
- Risk: Message loss when processors filter output; unexpected behavior
- Priority: Medium (feature interaction edge case)

---

*Concerns audit: 2026-01-27*
