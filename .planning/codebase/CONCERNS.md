# Codebase Concerns

**Analysis Date:** 2026-01-23

## Type Safety Issues

**Excessive @ts-expect-error Suppressions:**
- Issue: Core package has 253 instances of `@ts-expect-error` suppressing TypeScript errors
- Files: `packages/core/src/loop/network/` (34 occurrences), `packages/core/src/stream/base/output-format-handlers.ts` (multiple), broader core package
- Impact: Type errors masked instead of fixed, reduces code reliability, harder to catch regressions
- Fix approach: Audit all @ts-expect-error comments, fix underlying type issues systematically, use proper type narrowing instead of suppressions

**Stream Processing Type Casting:**
- Issue: `packages/client-sdks/client-js/src/resources/agent.ts:844` casts stream chunks as `any` with comment acknowledging it's "completely wrong"
- Files: `packages/client-sdks/client-js/src/resources/agent.ts` (lines 844-846)
- Impact: Untyped stream data causes runtime errors, tool invocations may fail silently
- Fix approach: Properly type stream chunks, fix underlying schema typing in core package

**Zod Schema Type Errors:**
- Issue: Multiple locations using `@ts-expect-error - TODO: remove once z.enum().optional().default() type error is fixed`
- Files:
  - `templates/template-flash-cards-from-pdf/src/mastra/workflows/flash-cards-generation-workflow.ts:248`
  - `templates/template-ad-copy-from-content/src/mastra/workflows/ad-copy-generation-workflow.ts:336,425`
  - `templates/template-pdf-to-audio/src/mastra/workflows/pdf-to-audio-workflow.ts:125`
  - `templates/template-pdf-to-audio/src/mastra/tools/text-to-speech-tool.ts:38`
- Impact: Schema definitions silently fail type checking, breaking workflows
- Fix approach: Create Zod schema helper for enum().optional().default() pattern or upgrade Zod version

## Known Bugs

**Undefined inputSchema Handling:**
- Issue: Tools and workflows without inputSchema cause "Cannot read properties of undefined (reading '_def')" error
- Files: `packages/core/src/loop/network/index.test.ts:119-149` (documented test failure), validation logic likely in `packages/core/src/loop/network/index.ts`
- Trigger: Create tool/workflow without inputSchema parameter, route through agent
- Workaround: Always provide inputSchema, even if empty (z.object({}))
- Fix approach: Add null-safe check before accessing Zod schema properties

**Gemini Live API Tool Execution:**
- Issue: Tool calls nested in `serverContent.modelTurn.parts.functionCall` are not handled, only top-level toolCall messages processed
- Files: `voice/google-gemini-live-api/src/tool-args-bug.test.ts:369-380` (documented failing test)
- Trigger: Gemini returns nested tool calls in specific format
- Impact: Voice agent tools don't execute despite being called
- Fix approach: Update tool execution handler to traverse modelTurn.parts structure

**Stream Validation Error Handling:**
- Issue: Multiple catch blocks in `packages/core/src/stream/base/output-format-handlers.ts:190-195,217-222` suppress errors with fallback to generic Error, losing original validation context
- Files: `packages/core/src/stream/base/output-format-handlers.ts`
- Impact: Validation failures are silent or produce unhelpful errors, hard to debug streaming issues
- Fix approach: Preserve and chain original error details through custom error type

## Large, Complex Files (Refactoring Candidates)

**Agent Implementation - 3911 lines:**
- File: `packages/core/src/agent/agent.ts`
- Issues: Single file handles agent config, execution, streaming, memory, processors, and multiple model versions
- Safe refactoring: Extract execution strategies (generate, stream, network) to separate modules

**Workflow Implementation - 3847 lines:**
- File: `packages/core/src/workflows/workflow.ts`
- Issues: Monolithic workflow builder, step composition, and execution logic in one file
- Safe refactoring: Split into workflow builder and step executor modules

**Network Loop - 2197 lines:**
- File: `packages/core/src/loop/network/index.ts`
- Issues: Mixing routing logic, validation, scoring, and stream processing
- Safe refactoring: Extract validation scoring to separate module, decompose routing logic

## Test Coverage Gaps

**Skipped Integration Tests:**
- Locations:
  - `packages/core/src/tools/unified-integration.test.ts` - Multiple tool calls structure test skipped
  - `packages/core/src/workflows/evented/evented-workflow.test.ts` - Entire Streaming suite skipped
  - `packages/core/src/agent/__tests__/stream.test.ts` - Critical stream interruption and message saving tests skipped
  - `packages/core/src/mastra/idgenerator.test.ts` - Complex workflow + memory test skipped
- Risk: Stream resumption, multi-tool orchestration, and async message persistence untested in CI
- Priority: High - these tests indicate known failures in critical paths

**Incomplete Test Utilities:**
- Files: `packages/codemod/scripts/scaffold-codemod.ts` lines 18, 34, 38 marked with `// TODO` - placeholder template inputs
- Impact: New codemod scaffolding partially incomplete, may generate broken codemods

## Deprecated & Staged Removal APIs

**Cloudflare Deployer Fields:**
- Files: `deployers/cloudflare/src/index.ts:11-40`
- Deprecated: `projectName`, `workerNamespace`, `d1Databases`, `kvNamespaces` parameters
- Comment states: "TODO remove deprecated fields in next major version"
- Impact: Breaking change planned but not yet executed; migration path exists but users not warned
- Timeline: Remove in v2

**Gemini Live API Session Resumption Unimplemented:**
- Files: `voice/google-gemini-live-api/src/index.ts:1050`, `voice/google-gemini-live-api/src/managers/SessionManager.ts:171-172`
- Status: Session handle returns undefined, contextSize returns 0
- Comment: "TODO: Return actual session handle when Gemini Live API supports session resumption"
- Impact: Voice sessions cannot resume, no session tracking
- Blocker: Waiting for Gemini Live API feature release

**Legacy Logger Deprecation:**
- Files: `packages/core/src/logger/default-logger.ts`
- Deprecated: `createLogger()` function
- Replacement: Use `new ConsoleLogger()` from "@mastra/core/logger"
- Impact: Old code still compiles but should be migrated

**Memory System Configuration Deprecated:**
- Files: `packages/core/src/memory/types.ts` and `packages/core/src/memory/memory.ts`
- Deprecated:
  - `processors` option in Memory (removed, use workflows instead)
  - `threads.generateTitle` (moved to top-level `generateTitle`)
  - `use` option in working memory (always uses tool-call mode)
- Impact: Old configs throw runtime errors with migration guides

## Tracing & Context Issues

**Missing Tracing Context in Client:**
- Files:
  - `packages/client-sdks/client-js/src/resources/agent.ts:1184-1185`
  - `packages/client-sdks/client-js/src/resources/agent.ts:1700`
- Issue: Comments state "TODO: Pass proper tracing context when client-js supports tracing"
- Impact: Client-side tool execution not traced, breaks observability for remote tool calls
- Blocker: Tracing context not yet added to client SDK

**Cross-Origin Request Tracing Disabled:**
- Files: `packages/client-sdks/client-js/src/resources/base.ts:43`
- Issue: "TODO: Bring this back once we figure out what we/users need to do to make this work with cross-origin requests"
- Impact: Cannot trace requests from cross-origin clients, observability gaps
- Blocker: Needs investigation of CORS implications for tracing headers

## Security & Validation Concerns

**Unstable Wrangler API Usage:**
- Files: `deployers/cloudflare/src/index.ts:7`
- Issue: Uses `Unstable_RawConfig` from wrangler (marked unstable)
- Comment: "Unstable_RawConfig is unstable, and no stable alternative exists"
- Impact: Deployer may break on wrangler updates
- Fix approach: Monitor wrangler for stable Config API, provide wrapper abstraction

**Output Validation Chain Complexity:**
- Files: `packages/core/src/stream/base/output-format-handlers.ts:180-222`
- Issue: Multiple validation paths (Zod vs AI SDK Schema) with overlapping logic and error handling
- Impact: Hard to debug why validation succeeds/fails, inconsistent error messages
- Fix approach: Unify validation pipeline with single error path

## Performance & Scaling Issues

**Regex Complexity Warning:**
- Files: `packages/core/src/memory/working-memory-utils.test.ts:147-181`
- Issue: Test documents "regex has quadratic complexity on pathological input"
- Impact: Working memory parsing can slow down on large conversation histories
- Fix approach: Profile with realistic message sizes, consider streaming JSON parser

**Test Data Generation Size:**
- Files: `packages/core/src/loop/test-utils/options.ts:8324 lines`
- Issue: Large test options file with extensive mock data generation
- Impact: Longer test suite initialization time, memory usage during testing
- Fix approach: Lazy-load test fixtures, parameterize common patterns

## Dependency Management

**Bundler External Dependencies Tracking:**
- Files: `packages/deployer/src/build/analyze/bundleExternals.ts` and `constants.ts`
- Issue: Maintains manual `DEPRECATED_EXTERNALS` list (fastembed, nodemailer, jsdom, sqlite3)
- Impact: Stale external tracking doesn't prevent accidental bundling, manual maintenance burden
- Fix approach: Automate detection based on package.json or scan-based approach

## User Context Issues

**TODO Comments in Production Code:**
- Files:
  - `templates/template-meeting-scheduler/src/mastra/index.ts:23` - "Retrieve unique user id and set it on the request context"
  - `templates/template-google-sheets/src/mastra/index.ts:46` - Same TODO
  - `workflows/inngest/src/run.ts:741,843` - "fix this, watch doesn't have a type"
  - `packages/codemod/src/codemods/v1/mastra-core-imports.ts:10` - "Do not hardcode this mapping"
- Impact: Templates shipped with incomplete implementation instructions, users may not realize they need custom context
- Fix approach: Complete user context setup in templates, add CI check for TODO in shipped code

---

*Concerns audit: 2026-01-23*
