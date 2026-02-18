# Codebase Concerns

**Analysis Date:** 2026-01-27

## Tech Debt

**Type Safety Erosion:**

- Issue: Heavy use of `any` types throughout evals module
- Files: `packages/core/src/evals/base.ts`, `packages/core/src/evals/run/index.ts`
- Impact: Runtime type errors, reduced IDE support, maintenance difficulty
- Fix approach: Add proper generics and type narrowing to scorer/eval interfaces

**@ts-expect-error Accumulation:**

- Issue: 100+ `@ts-expect-error` comments in packages/core
- Files: `packages/core/src/stream/base/output.ts`, `packages/core/src/llm/model/model.ts`, `packages/core/src/test-utils/llm-mock.ts`
- Impact: Hidden type mismatches, potential runtime errors
- Fix approach: Address underlying type issues, especially in stream output handling

**Nested Output Type Confusion:**

- Issue: Unknown type structure for nested tool-call output
- Files: `packages/core/src/stream/base/output.ts:479-481`
- Impact: Unpredictable behavior in agent output processing
- Fix approach: Document and type the `output.from === 'AGENT'` pattern

**License Validation Stub:**

- Issue: EE license validation is a placeholder (any 32+ char string passes)
- Files: `packages/core/src/ee/license.ts:42-52`
- Impact: No actual license enforcement for enterprise features
- Fix approach: Implement signature verification and server validation

**Vector Store Memory Leak on Delete:**

- Issue: Thread deletion does not clean up vector store entries
- Files: `stores/libsql/src/storage/domains/memory/index.ts:573`, `stores/mssql/src/storage/domains/memory/index.ts:1088`, `stores/upstash/src/storage/domains/memory/index.ts:1138`
- Impact: Orphaned vector embeddings, growing storage costs
- Fix approach: Cascade delete to vector store when semantic recall is enabled

**Multi-Version SDK Support:**

- Issue: v1/v2/v3 model version branching throughout agent code
- Files: `packages/core/src/agent/__tests__/`, `packages/core/src/agent/agent.ts:2023`
- Impact: Test complexity, maintenance burden, conditional code paths
- Fix approach: Deprecate v1, consolidate to single version

## Known Bugs

**Elasticsearch 9.x Incompatibility:**

- Symptoms: `updateVector` fails, dense_vector fields not returned from client.get()
- Files: `stores/elasticsearch/docker-compose.yaml:5`
- Trigger: Upgrade to Elasticsearch 9.x
- Workaround: Pin to 8.17.0

**Pinecone Tests Disabled:**

- Symptoms: Tests skipped in CI due to account limits
- Files: `stores/pinecone/src/vector/index.test.ts:15,115`
- Trigger: Running tests in CI
- Workaround: Run locally only

**LibSQL Regex Not Supported:**

- Symptoms: Regex filter operations fail silently
- Files: `stores/libsql/src/vector/filter.ts:63,75,117`, `stores/libsql/src/vector/sql-builder.ts:444`
- Trigger: Using regex patterns in vector queries
- Workaround: Use alternative filter strategies

## Security Considerations

**Console Logging in Production:**

- Risk: Sensitive data may be logged via console.warn/console.log
- Files: `packages/core/src/llm/model/provider-registry.ts:97,139,151,165`, `packages/core/src/llm/model/gateways/azure.ts:83,147`
- Current mitigation: None
- Recommendations: Replace with structured logger, add log level filtering

**Environment Variable Exposure:**

- Risk: API keys accessed directly from process.env without validation
- Files: `packages/core/src/llm/model/embedding-router.ts:178,182`, `packages/core/src/llm/model/gateways/netlify.ts:68-69,144-145`, `packages/core/src/llm/model/gateways/models-dev.ts:170`
- Current mitigation: None
- Recommendations: Centralize env access, add validation, mask in logs

**License Bypass:**

- Risk: EE features can be enabled with any 32+ character string
- Files: `packages/core/src/ee/license.ts:49-52`
- Current mitigation: None - validation is a stub
- Recommendations: Implement cryptographic signature verification

## Performance Bottlenecks

**Large Core Files:**

- Problem: Several files exceed 1000+ lines
- Files: `packages/core/src/agent/agent.ts` (3911 lines), `packages/core/src/workflows/workflow.ts` (3847 lines), `packages/core/src/mastra/index.ts` (3178 lines)
- Cause: Monolithic class design
- Improvement path: Extract concerns into focused modules

**Test Options File:**

- Problem: 8324 line test utility file
- Files: `packages/core/src/loop/test-utils/options.ts`
- Cause: Generated or accumulated test fixtures
- Improvement path: Split by test domain, use factories

## Fragile Areas

**Stream Output Processing:**

- Files: `packages/core/src/stream/base/output.ts`
- Why fragile: Complex state machine with unclear type contracts, nested output handling with @ts-expect-error
- Safe modification: Add comprehensive integration tests before changes
- Test coverage: Unit tests exist but type safety gaps

**Provider Registry Cache:**

- Files: `packages/core/src/llm/model/provider-registry.ts`
- Why fragile: File-based cache with race condition history (PR #10434)
- Safe modification: Maintain atomic write pattern, test concurrent scenarios
- Test coverage: Has race condition tests but edge cases possible

**Agent Message List:**

- Files: `packages/core/src/agent/message-list/`
- Why fragile: Multiple input/output format conversions (v4, v5, Gemini, UI)
- Safe modification: Test all format combinations
- Test coverage: Good coverage but many version-specific branches

## Scaling Limits

**In-Memory License Cache:**

- Current capacity: Single cached result with 1-minute TTL
- Limit: No distributed cache support
- Scaling path: Add Redis/external cache for multi-instance deployments

**Provider Registry Refresh:**

- Current capacity: Periodic refresh with file-based cache
- Limit: File I/O on every cold start, potential race conditions
- Scaling path: Distributed cache, longer TTL for production

## Dependencies at Risk

**AI SDK Version Split:**

- Risk: Maintaining v4 and v5 compatibility simultaneously
- Impact: Dual code paths, type gymnastics, @ts-expect-error usage
- Migration plan: Complete v5 migration, deprecate v4 imports

**@internal/ai-sdk-v4:**

- Risk: Internal package dependency for legacy support
- Impact: Maintenance burden, type conflicts
- Migration plan: Remove v4 references once v5 stable

## Missing Critical Features

**Storage API Gaps:**

- Problem: No API to get a single span by ID
- Files: `packages/core/src/evals/scoreTraces/scoreTracesWorkflow.ts:109`
- Blocks: Efficient trace scoring workflows

**Module Resolve Multi-Version:**

- Problem: No multi-version support for module resolution
- Files: `packages/deployer/src/build/plugins/module-resolve-map.ts:18`
- Blocks: Complex monorepo scenarios

## Test Coverage Gaps

**Skipped Tests:**

- What's not tested: Multiple agent stream tests, tool approval in v1
- Files: `packages/core/src/agent/__tests__/stream.test.ts:44,178,243`, `packages/core/src/agent/agent.test.ts:4191,4307,4369,4483`
- Risk: Incremental message saving, abort handling not validated
- Priority: High - these are core agent behaviors

**Fleur Processor:**

- What's not tested: Entire test suite skipped
- Files: `packages/mcp-registry-registry/src/registry/__tests__/processors/fleur.test.ts:6`
- Risk: Fleur integration may be broken
- Priority: Medium

**Evented Workflow Streaming:**

- What's not tested: Streaming tests skipped
- Files: `packages/core/src/workflows/evented/evented-workflow.test.ts:808`
- Risk: Workflow streaming behavior untested
- Priority: Medium

**Bundler Test Flakiness:**

- What's not tested: Inconsistent external count
- Files: `packages/deployer/src/build/analyze/bundleExternals.test.ts:417`
- Risk: Bundle analysis may produce inconsistent results
- Priority: Low

---

_Concerns audit: 2026-01-27_
