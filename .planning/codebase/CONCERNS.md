# Codebase Concerns

**Analysis Date:** 2026-01-26

## Tech Debt

**Deprecated Cloudflare Deployer Configuration Fields:**
- Issue: Fields `projectName`, `workerNamespace`, `d1Databases`, and `kvNamespaces` are marked as deprecated but still supported for backward compatibility. TODO comment indicates these should be removed in next major version.
- Files: `deployers/cloudflare/src/index.ts` (lines 11-60)
- Impact: Maintains legacy API surface, increases maintenance burden, creates confusion for users about which API to use
- Fix approach: Plan major version update to remove deprecated parameters and migrate existing users to standard wrangler.json property names

**Incomplete Deprecation in Vercel Deployer:**
- Issue: Vercel deployer logs deprecation warning but provides no migration path or alternative
- Files: `deployers/vercel/src/index.ts` (line 102)
- Impact: Users are warned to use dashboard but framework provides no structured alternative
- Fix approach: Either remove Vercel deployer entirely or implement proper migration guidance

**Unresolved TypeScript Type Casting Issues:**
- Issue: 2,362+ instances of `as any`, `as unknown`, `@ts-expect-error`, and `@ts-ignore` across packages indicate widespread type safety gaps
- Files: Throughout `packages/` directory - particularly in:
  - `packages/core/src/agent/agent.ts` (15+ instances)
  - `packages/core/src/stream/base/output.ts` (multiple @ts-expect-error with TODO comments)
  - `client-sdks/client-js/src/resources/agent.ts` (casting as any)
- Impact: Reduces type safety, hides bugs, makes refactoring risky, creates false confidence in IDE support
- Fix approach: Gradually eliminate type casts by improving type definitions; start with highest-impact files

## Known Bugs

**Elasticsearch 9.x Compatibility Broken:**
- Symptoms: `updateVector` operation fails with ES 9.x because `client.get()` no longer returns dense_vector fields
- Files: `stores/elasticsearch/docker-compose.yaml` (line 5), Reference: https://github.com/mastra-ai/mastra/issues/11628
- Trigger: Upgrading Elasticsearch from 8.17.0 to 9.x versions
- Workaround: Stay on Elasticsearch 8.17.0 or older until vector handling is refactored
- Impact: Blocks Elasticsearch users from upgrading, creates security/performance debt

**LibSQL Regex Support Not Implemented:**
- Symptoms: Regex patterns fail silently or throw errors in LibSQL vector filtering
- Files: `stores/libsql/src/vector/filter.ts` (lines 63, 75, 117), `stores/libsql/src/vector/sql-builder.ts` (line 444)
- Trigger: Using $regex operator in vector filters with LibSQL backend
- Workaround: Use non-regex filters ($eq, $in, $contains, $size) instead
- Impact: Reduces filtering capability for LibSQL users, inconsistent with MongoDB-compatible API

**Turbopuffer Schema Configuration Missing:**
- Symptoms: Error thrown with "TODO: add schema for index" message
- Files: `stores/turbopuffer/src/vector/index.ts` (line 55)
- Trigger: Using custom indexes without proper schema definition
- Workaround: Only use pre-configured indexes
- Impact: Blocks dynamic index creation for Turbopuffer backend

**Pinecone and Turbopuffer Tests Skipped in CI:**
- Symptoms: Vector store tests for Pinecone and Turbopuffer are disabled/skipped
- Files:
  - `stores/pinecone/src/vector/index.test.ts` (lines 15, 115)
  - `stores/turbopuffer/src/vector/index.test.ts` (line 17)
- Trigger: Running test suite in CI environment
- Workaround: Tests have TODO comments indicating secrets need to be available in CI; currently skipped because Pinecone account is over limit
- Impact: No test coverage for these critical backends in CI pipeline, regressions go undetected

## Cross-Origin Request Limitation

**Client SDK Missing x-mastra-client-type Header:**
- Issue: Header `x-mastra-client-type: js` is commented out with TODO indicating cross-origin request problems
- Files: `client-sdks/client-js/src/resources/base.ts` (line 43)
- Current state: Header support is disabled but not fully investigated
- Impact: Client-side tracking and analytics cannot identify JavaScript SDK requests, breaks observability for client usage patterns
- Recommended action: Investigate CORS policy and either implement proper header handling or document the limitation

**Client SDK Stream Type Mismatch:**
- Symptoms: Type casting as `any` used throughout stream processing, indicating broken typing
- Files: `client-sdks/client-js/src/resources/agent.ts` (lines 844-846)
- Details: Comments indicate stream types were all typed as any before, making current implementation "completely wrong"
- Impact: Stream processing may fail silently, tool invocations could be mishandled
- Fix approach: Remove `:any` type cast and properly type stream chunks; currently hidden type errors will surface

## Memory System Gaps

**Vector Store Deletion Not Implemented for Memory Messages:**
- Issue: When deleting messages with semantic recall enabled, deletion only occurs from relational storage, not from vector store
- Files:
  - `stores/libsql/src/storage/domains/memory/index.ts` (line 573)
  - `stores/mssql/src/storage/domains/memory/index.ts` (line 1088)
  - `stores/upstash/src/storage/domains/memory/index.ts` (line 1138)
- Impact: Deleted messages remain searchable via semantic recall, creating data consistency issues and potential memory leaks in vector stores
- Priority: High - affects data integrity and compliance (deleted data should not be searchable)
- Fix approach: Implement vector store deletion in memory delete operations across all storage backends

## Observability Gaps

**OpenTelemetry Semantic Convention Coverage Incomplete:**
- Issue: Output type attributes for GenAI spans not fully mapped to OTEL conventions
- Files: `observability/otel-exporter/src/gen-ai-semantics.ts` (lines 195-196, 282, 321)
- Details: TODO comments indicate missing attributes for image/json/speech/text output types
- Impact: Observability dashboards cannot distinguish output types, making analysis of model outputs harder
- Fix approach: Implement complete attribute mapping for all output types

**Storage API for Single Span Retrieval Missing:**
- Issue: Scoretraces workflow must fetch entire traces to get single span data
- Files: `packages/core/src/evals/scoreTraces/scoreTracesWorkflow.ts` (line 109)
- Impact: Inefficient span queries, higher latency for scoring operations
- Recommended improvement: Add storage API method to fetch individual spans by ID

**Gemini Live API Session Resumption Not Supported:**
- Symptoms: `getSessionHandle()` returns undefined even after sessions are created
- Files: `voice/google-gemini-live-api/src/index.ts` (lines 1050-1051)
- Trigger: Attempting to resume Gemini Live API sessions
- Workaround: None available
- Impact: Voice conversations cannot be resumed, limiting long-running voice interactions
- Blockers: Awaiting API support from Google

**Gemini Live API Session Configuration Missing:**
- Issue: Session context size and config are placeholder values (undefined/0)
- Files: `voice/google-gemini-live-api/src/managers/SessionManager.ts` (lines 171-172)
- Impact: Session metadata is incomplete, cannot optimize context window usage
- Dependencies: Awaiting Google Gemini Live API enrichment

## Workflow Type Safety Issues

**Complex Workflow Types Not Well-Typed:**
- Issue: Multiple TODO comments indicate type definitions need improvement
- Files: `packages/core/src/workflows/workflow.ts` (lines 1571, 1617-1618)
- Details: Type overloads for workflow variables and watch patterns lack proper typing, using fallback `any` types
- Impact: IDE autocomplete unreliable, runtime type errors not caught at compile time
- Fix approach: Implement proper generic types for:
  - mapVariable overloads for state schemas
  - Watch conditions and patterns
  - Add state schema to workflow type system

**Workflow Watch Type Definitions Incomplete:**
- Issue: Three instances of untyped watch conditions
- Files: `packages/core/src/workflows/workflow.ts` (lines 2978, 3104, 3772)
- Details: Comments indicate "watch doesn't have a type" - watch functionality bypasses type system
- Impact: Watch conditions are effectively untyped, potential runtime failures
- Fix approach: Define proper types for watch target expressions and conditions

## Performance and Complexity Concerns

**Large Complex Files with Multiple Responsibilities:**
- Files with 2000+ lines indicate potential architectural issues:
  - `packages/core/src/workflows/workflow.ts` (3,847 lines) - Workflow orchestration, step management, type definitions
  - `packages/core/src/agent/agent.ts` (3,911 lines) - Agent lifecycle, tool execution, streaming
  - `packages/core/src/mastra/index.ts` (3,309 lines) - Central orchestration, configuration management
- Impact: Difficult to test, understand, and modify; high cognitive load; more bugs per line
- Fix approach: Break into smaller, focused modules with clear responsibilities

**Bundle Analysis Flakiness:**
- Issue: Output chunk count is inconsistent and commented as "TODO fix why it's not always 4"
- Files: `packages/deployer/src/build/analyze/bundleExternals.test.ts` (line 417)
- Impact: Tests are unreliable, may pass/fail sporadically, indicating non-deterministic bundling behavior
- Fix approach: Investigate and stabilize bundle output structure

## Test Coverage Gaps

**Concurrent Storage Update Test Disabled:**
- Issue: Test marked as `.todo()` - requires atomic transaction support
- Files: `stores/_test-utils/src/domains/workflows/index.ts` (lines 639-696)
- Problem: Stores without transaction support (Upstash) cannot run this test, creating coverage gaps
- Impact: Concurrent workflow state updates are untested for some backends, potential race conditions
- Recommended approach: Implement transactional semantics for affected stores or isolate test to compatible backends

**Tool Builder Model Compatibility Issues:**
- Symptoms: Certain tests are skipped or disabled for specific models
- Files: `packages/core/src/tools/tool-builder/builder.test.ts` (lines 49, 141)
- Issues:
  - Gemini 2.5 Flash has problematic behavior with structured output
  - JSON prompt injection doesn't work well for some models
  - Schema compatibility varies by provider
- Impact: Tool building behavior varies by model, potential runtime surprises for users
- Recommended: Document model-specific limitations in API docs

**Partial Object Validation Not Tested:**
- Issue: Partial JSON chunk validation is commented as TODO
- Files: `packages/core/src/stream/base/output-format-handlers.ts` (lines 296, 307, 361)
- Details: Comments indicate edge cases for partial object streaming not yet validated
- Impact: Partial streaming mode may produce invalid output silently
- Fix approach: Implement and test partial object validation, add error chunk emission

## Deployer and Build Issues

**Multi-Version Dependency Support Not Implemented:**
- Issue: Module resolution map doesn't support multiple versions of same dependency
- Files: `packages/deployer/src/build/plugins/module-resolve-map.ts` (line 18)
- Impact: Monorepos with dependency conflicts cannot properly resolve modules, bundling may fail
- Fix approach: Implement version-aware module resolution

## Tool Execution Type Casting

**Tool ID Type Handling Requires Casting:**
- Issue: Tool ID type checks require `as any` casting
- Files: `packages/core/src/agent/agent.ts` (lines 1315-1316)
- Details: Dynamic tool ID detection uses `typeof (tool as any).id` pattern
- Impact: Tool registry doesn't have proper type safety for ID resolution
- Fix approach: Improve Tool type definition to explicitly include optional `id` property

## Known Limitations

**JSON Prompt Injection Handling Inconsistent:**
- Issue: JSON prompt injection validation commented out with note it "doesn't work very well"
- Files: `packages/core/src/tools/tool-builder/builder.test.ts` (line 141)
- Current status: Disabled, would work better with schema compatibility improvements
- Impact: JSON injection attacks may not be fully prevented; security validation incomplete
- Recommendation: Re-evaluate when schema compatibility is improved

**Output Format Partial Type Validation Incomplete:**
- Issue: Runtime partial object validation for JSON streaming produces incomplete type checking
- Files: `packages/core/src/stream/base/output-format-handlers.ts` (line 604)
- Details: Comment indicates "TODO: handle partial runtime type validation of json chunks"
- Impact: Streaming JSON objects may be partially invalid without detection until completion
- Recommendation: Implement streaming schema validation with early error detection

---

*Concerns audit: 2026-01-26*
