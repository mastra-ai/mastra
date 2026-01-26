# Codebase Concerns

**Analysis Date:** 2026-01-26

## Tech Debt

**Evented Workflows Step Executor - Incomplete Implementation:**

- Issue: Multiple `throw new Error('Not implemented')` calls in critical execution paths
- Files: `packages/core/src/workflows/evented/step-executor.ts` (lines 298, 366, 369, 440, 443)
- Impact: The evented workflow engine cannot execute certain control flow operations like `bail()` and `suspend()` in some contexts
- Fix approach: Implement the missing functionality for bail/suspend in condition evaluation and sleep resolution contexts

**Evented Workflows - Missing Features:**

- Issue: Many `// TODO` placeholders throughout evented workflow system (~30+ in step-executor alone)
- Files:
  - `packages/core/src/workflows/evented/step-executor.ts`
  - `packages/core/src/workflows/evented/workflow-event-processor/loop.ts`
  - `packages/core/src/workflows/evented/workflow-event-processor/sleep.ts`
  - `packages/core/src/workflows/evented/workflow-event-processor/parallel.ts`
  - `packages/core/src/workflows/evented/workflow.ts`
- Impact: State management not fully implemented, stream support incomplete, tracing context not passed properly
- Fix approach: Complete state implementation, add streaming support, pass proper tracing context

**Type Safety - Excessive `as any` Casts:**

- Issue: 262 `as any` type casts in `packages/core/src` (non-test files), ~105 files with casts across packages
- Files: Throughout codebase, concentrated in:
  - `packages/core/src/workflows/workflow.ts`
  - `workflows/inngest/src/run.ts`
  - `workflows/inngest/src/index.ts`
- Impact: Type safety bypassed, potential runtime errors not caught at compile time
- Fix approach: Gradually replace with proper type definitions, use type guards, or create explicit type narrowing

**Workflow Typing Issues:**

- Issue: Multiple TODO comments indicate broken/incomplete typing in workflow system
- Files:
  - `packages/core/src/workflows/workflow.ts` (lines 1571, 1617, 1618)
  - Comments: "TODO: make typing better here", "TODO: add state schema to the type, this is currently broken"
- Impact: Type inference may not work correctly for parallel/branch workflows
- Fix approach: Redesign workflow step type inference, particularly for parallel and branch operations

**Memory Deletion - Incomplete Vector Store Cleanup:**

- Issue: TODO comments indicate vector store entries are not deleted when threads/messages are deleted
- Files:
  - `packages/memory/src/index.ts` (line 1195)
  - `stores/upstash/src/storage/domains/memory/index.ts` (line 1138)
  - `stores/mssql/src/storage/domains/memory/index.ts` (line 1088)
  - `stores/libsql/src/storage/domains/memory/index.ts` (line 573)
- Impact: Orphaned vector entries consume storage, semantic recall may return results from deleted conversations
- Fix approach: Implement vector store cleanup when deleting threads/messages with semantic recall enabled

## Known Bugs

**Parallel/Branch Workflow Suspend/Resume State Bug:**

- Symptoms: Workflow shows "suspended" instead of "success" after resuming all suspended steps in parallel/branch scenarios
- Files: `packages/core/src/workflows/workflow.test.ts` (line 16521)
- Trigger: Resume operations on workflows with parallel branches that contain suspend points
- Workaround: Test expects `['success', 'suspended']` instead of just `'success'`

**Message Ordering Bug (Issue #9909):**

- Symptoms: Text content that appears before tool calls in streams may be missing or reordered in storage/recall
- Files: `packages/memory/integration-tests/src/shared/message-ordering.ts` (lines 563-577)
- Trigger: Streaming responses where model generates text before calling tools
- Workaround: None documented

**v1 Messages with Same ID Replacement:**

- Symptoms: Messages with the same ID replace each other instead of being treated as separate entries
- Files: `packages/core/src/agent/message-list/tests/message-list.test.ts` (line 3333)
- Trigger: Memory processor flow with v1 message format
- Workaround: Use v5+ message format

**Gemini Live Voice Tool Arguments (Issue #10161):**

- Symptoms: Tools not called because function_response is not handled correctly
- Files: `voice/google-gemini-live-api/src/tool-args-bug.test.ts`
- Trigger: Using tools with Gemini Live API
- Workaround: None documented - test file documents the bug

## Security Considerations

**Environment Variable Exposure:**

- Risk: API keys accessed directly from `process.env` in production code
- Files:
  - `packages/core/src/llm/model/embedding-router.ts` (lines 178, 182)
  - `packages/core/src/llm/model/gateways/netlify.ts` (lines 68-69, 144-145)
  - `packages/core/src/llm/model/gateways/models-dev.ts` (lines 154, 170)
- Current mitigation: Keys are read at runtime, not bundled
- Recommendations: Consider centralized secret management, environment validation at startup

**Console Logging of Sensitive Data:**

- Risk: Debug logging may expose sensitive information in production
- Files:
  - `packages/core/src/stream/aisdk/v5/transform.ts` (line 140) - logs tool call input errors
  - `packages/core/src/processors/processors/*.ts` - multiple warn/info logs
  - `packages/core/src/observability/context.ts` - error logging
- Current mitigation: Some logging is conditional on environment
- Recommendations: Add log level controls, ensure sensitive data is redacted

## Performance Bottlenecks

**Large File Sizes:**

- Problem: Some core files are extremely large, impacting maintainability and potentially load time
- Files:
  - `packages/core/src/workflows/workflow.test.ts` (21,573 lines)
  - `packages/core/src/workflows/evented/evented-workflow.test.ts` (12,312 lines)
  - `packages/core/src/agent/agent.ts` (3,911 lines)
  - `packages/core/src/workflows/workflow.ts` (3,847 lines)
  - `packages/core/src/mastra/index.ts` (3,309 lines)
- Cause: Monolithic design, test files containing many scenarios
- Improvement path: Split into smaller focused modules, extract test utilities

**Provider Registry Auto-Refresh:**

- Problem: Background interval refreshing provider registry
- Files: `packages/core/src/llm/model/provider-registry.ts` (line 552)
- Cause: `setInterval` for auto-refreshing providers in dev mode
- Improvement path: Ensure interval is properly cleared on shutdown, consider lazy refresh

**ROW_NUMBER Performance (Issue #11150):**

- Problem: Slow pagination on large tables
- Files: `stores/pg/src/storage/domains/memory/row-number-performance.test.ts`
- Cause: Previous implementation used ROW_NUMBER which is slow on large tables
- Improvement path: Fixed in `stores/pg/src/storage/domains/memory/index.ts` (line 495) - using optimized approach

## Fragile Areas

**Workflow State Management:**

- Files:
  - `packages/core/src/workflows/workflow.ts`
  - `packages/core/src/workflows/evented/workflow-event-processor/index.ts`
- Why fragile: Complex state tracking across suspend/resume, parallel execution, nested workflows
- Safe modification: Run full workflow test suite, test suspend/resume scenarios explicitly
- Test coverage: Good coverage exists but tests document existing bugs

**Message List Format Detection:**

- Files: `packages/core/src/agent/message-list/detection/TypeDetector.ts`
- Why fragile: Must handle multiple message formats (v1, v4, v5, UI messages)
- Safe modification: Ensure all format tests pass, check backward compatibility
- Test coverage: `packages/core/src/agent/message-list/tests/message-list.test.ts`

**Inngest Integration Type Handling:**

- Files:
  - `workflows/inngest/src/run.ts` (many `as any` casts)
  - `workflows/inngest/src/index.ts`
- Why fragile: Heavy use of type assertions to work around AI SDK type mismatches
- Safe modification: Check integration tests thoroughly
- Test coverage: `workflows/inngest/src/index.test.ts` (comprehensive but many `as any` in tests too)

## Scaling Limits

**In-Memory Provider Registry:**

- Current capacity: All registered providers held in memory
- Limit: Memory usage grows with number of providers/models
- Scaling path: Lazy loading of provider configurations

**Test Suite Duration:**

- Current capacity: Full test run is extensive (21K+ lines in main workflow test file alone)
- Limit: CI time increases as tests grow
- Scaling path: Parallel test execution, test sharding

## Dependencies at Risk

**Deprecated Externals:**

- Risk: `fastembed`, `nodemailer`, `jsdom`, `sqlite3` marked as deprecated in bundler
- Files: `packages/deployer/src/build/analyze/constants.ts` (line 14)
- Impact: These packages are externalized but may cause issues
- Migration plan: Listed for removal, ensure no direct dependencies

**Zod Version Compatibility:**

- Risk: Users may use Zod 4 while Mastra uses Zod 3 internally
- Files: Multiple comments about Zod compatibility issues in:
  - `packages/core/src/agent/agent.ts` (processor workflow creation)
  - `templates/template-pdf-to-audio/src/mastra/tools/text-to-speech-tool.ts`
- Impact: Schema validation can fail across versions
- Migration plan: Schema compat layer exists in `packages/schema-compat`

## Missing Critical Features

**Evented Workflow Streaming:**

- Problem: Streaming not fully implemented for evented workflows
- Blocks: Real-time workflow output for evented engine
- Files: `packages/core/src/workflows/evented/workflow.ts` (lines 333, 344, 1315)

**Watch Event Typing:**

- Problem: `watch` doesn't have a proper type definition
- Blocks: Type-safe event watching in workflows
- Files: `packages/core/src/workflows/workflow.ts` (lines 2978, 3104, 3772)

## Test Coverage Gaps

**Skipped Tests - Network/Integration:**

- What's not tested: Agent network tests, many integration tests
- Files: `packages/core/src/agent/agent-network.test.ts` (line 37 - entire describe.skip)
- Risk: Agent network collaboration scenarios not validated
- Priority: High

**Skipped Tests - Vector Stores:**

- What's not tested: Several vector store implementations have skipped tests
- Files:
  - `stores/pinecone/src/vector/index.test.ts` (line 116 - describe.skip)
  - `stores/astra/src/vector/index.test.ts` (line 61 - describe.skip)
  - `stores/convex/src/vector/index.test.ts` (line 19 - describe.skip)
  - `stores/convex/src/storage/index.test.ts` (line 36 - describe.skip)
- Risk: Vector store bugs may go undetected, integration issues not caught
- Priority: Medium

**Skipped Tests - Schema Compatibility:**

- What's not tested: Optional object/array/scalar schema handling
- Files: `packages/schema-compat/src/schema-compatibility-v4.test.ts` (lines 501, 517, 529)
- Risk: Schema transformation edge cases may fail
- Priority: Medium

**Tests Requiring Real Models:**

- What's not tested in CI: Tests that need actual API keys
- Files: Various `skipIf` conditions checking for API keys
- Risk: Real-world model integration not validated in automated tests
- Priority: Low (expected limitation)

---

_Concerns audit: 2026-01-26_
