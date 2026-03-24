# Autoresearch Analysis Report

> Analysis performed using the [pi-autoresearch](https://github.com/davebcn87/pi-autoresearch) methodology:
> measure, identify improvements, prioritize by impact.

**Date**: 2026-03-24
**Codebase**: mastra-agent-pk (Mastra AI Framework monorepo)

---

## Executive Summary

This analysis identified **4 critical**, **8 high**, and **12 medium-priority** improvement opportunities across security, code quality, testing, and dependency management. The most impactful findings are a critical RCE vulnerability in a transitive dependency, production error handlers that silently swallow errors, and zero test coverage on key infrastructure modules.

---

## 1. Security Vulnerabilities (Critical)

### 1.1 Critical: `simple-git` RCE (CVSS High)
- **Path**: `observability/braintrust > braintrust > simple-git (>=3.15.0, <3.32.3)`
- **Issue**: Remote code execution via `blockUnsafeOperationsPlugin` bypass
- **Fix**: Update `braintrust` or add pnpm override for `simple-git >= 3.32.3`

### 1.2 High: `tar` Path Traversal (6 advisories)
- **Path**: `packages/fastembed > fastembed > tar` and `onnxruntime-node > tar`
- **Issue**: Multiple path traversal and arbitrary file write vulnerabilities
- **Fix**: Add pnpm override `tar >= 7.5.8`

### 1.3 High: `kysely` SQL Injection
- **Path**: `auth/better-auth > better-auth > kysely`
- **Issue**: SQL injection via unsanitized JSON path keys
- **Fix**: Update `better-auth` to version with patched `kysely`

### 1.4 High: `run-command-tool.ts` uses `exec()` instead of `execFile()`
- **File**: `packages/core/src/loop/network/run-command-tool.ts:249`
- **Issue**: Uses shell-based `exec()` instead of safer `execFile()`. The `allowUnsafeCharacters: true` option (line 117) bypasses metacharacter checks entirely. Default `allowedCommands` is empty (permissive).
- **Fix**: Switch to `execFile()` with argument splitting; make `allowedCommands` require explicit opt-in.

### 1.5 Total: 47 vulnerabilities (1 critical, 31 high, 10 moderate, 5 low)
Full audit available via `pnpm audit`.

---

## 2. Code Quality Issues (High Impact)

### 2.1 Production Error Swallowing
- **File**: `packages/core/src/stream/RunOutput.ts:153,317`
- **Issue**: `.catch()` handlers use `console.log(' something went wrong', reason)` — errors are silently swallowed with an unprofessional message. No re-throw, no proper logging.
- **Impact**: Stream errors in production are invisible to operators.

### 2.2 Past-Due Deprecation
- **File**: `packages/core/src/workflows/utils.ts:216`
- **Issue**: `runCount` deprecation warning says "will be removed on November 4th, 2025" — that date was 5 months ago.
- **Action**: Remove the deprecated code path.

### 2.3 Stub License Validation
- **File**: `packages/core/src/auth/ee/license.ts:42`
- **Issue**: `// TODO: Implement actual license validation` — Enterprise Edition license check is a no-op.

### 2.4 `any` Type Usage: 3,010 occurrences across 289 files

Top offenders in production code:

| File | Count |
|------|-------|
| `workflows/workflow.ts` | 62 |
| `agent/agent-legacy.ts` | 45 |
| `workflows/evented/workflow-event-processor/index.ts` | 42 |
| `agent/agent.ts` | 34 |
| `workflows/evented/step-executor.ts` | 26 |

### 2.5 Silent Control Flow Changes on Error
- **Files**: `workflows/evented/step-executor.ts:350-352,518-520,603-605`
- **Issue**: Condition evaluation errors are caught and silently return `false` or `0`, changing program control flow without surfacing the error.

### 2.6 ~55 TODO/FIXME Comments in Core
Notable items:
- `stream/base/output.ts:574`: `@ts-expect-error TODO: What does this mean???`
- `workflows/workflow.ts`: 6+ TODOs about broken types
- `tool-loop-agent/tool-loop-processor.ts:106-114`: 3 TODOs about incompatible callback signatures

---

## 3. Testing Gaps (High Impact)

### 3.1 No Coverage Thresholds Configured
- `@vitest/coverage-v8` is installed but never configured with thresholds, reporters, or CI enforcement.
- **Fix**: Add minimum coverage thresholds (e.g., 70% lines/branches) to vitest config.

### 3.2 Key Modules with Zero Test Coverage

| Module | Lines of Code | Risk Level |
|--------|--------------|------------|
| `vector/` | ~354 lines | **High** — infrastructure many features depend on |
| `logger/` | ~287 lines (6 files) | **High** — logger bugs are hard to debug in production |
| `utils/` (fetchWithRetry, zod-utils) | ~221 lines | **High** — used throughout codebase |
| `events/` (event-emitter, pubsub) | ~65 lines | **Medium** — cross-cutting infrastructure |

### 3.3 62 Skipped Tests in Core
- `loop/test-utils/options.ts`: 12 skips (core loop behavior)
- `loop/test-utils/tools.ts`: 4 skips (provider-executed tools)
- `agent/agent.e2e.test.ts`: 5 skips (partial message rescue, incremental save)
- `tools/tool-builder/schema-compat-validation.test.ts`: 3 skips (validation bug demos)

### 3.4 Memory Package: `isolate: false`
- Tests share state, which can cause intermittent failures from test ordering dependencies.

---

## 4. Dependency Management

### 4.1 Deprecated Package: `json-schema@0.4.0`
- Last published ~2013, predates modern JSON Schema standards. Consider replacing with `ajv` (already a dependency).

### 4.2 26 Dependencies Using `"*"` Version Range
- Mostly in test-utils and integration-test packages. Could pull in breaking changes unexpectedly.
- **Fix**: Pin to `workspace:*` or explicit versions.

### 4.3 `dotenv` Version Inconsistency
- Mixed versions (`^17.2.3` and `^17.3.1`) across 20+ package.json files.
- **Fix**: Standardize via pnpm catalog.

---

## 5. Potential Memory Leaks

### 5.1 Anonymous Event Listener
- **File**: `workflows/workflow.ts:2271`
- `abortSignal.addEventListener('abort', async () => {...})` — anonymous arrow function cannot be removed.

### 5.2 Subprocess Listeners Without Cleanup
- **File**: `workspace/sandbox/local-process-manager.ts:54,74,88,92`
- `subprocess.on('close')`, `.on('error')`, `.stdout?.on('data')`, `.stderr?.on('data')` with no explicit cleanup. Relies on subprocess termination.

---

## Prioritized Action Plan

### Immediate (Security)
1. Add pnpm overrides for `simple-git >= 3.32.3` and `tar >= 7.5.8`
2. Switch `run-command-tool.ts` from `exec()` to `execFile()`
3. Update `better-auth` for `kysely` SQL injection fix

### Short-term (Code Quality)
4. Fix `RunOutput.ts` error handlers — replace `console.log` with proper error propagation
5. Remove past-due `runCount` deprecation (was due November 2025)
6. Fix silent error swallowing in `step-executor.ts`

### Medium-term (Testing)
7. Add vitest coverage thresholds and CI enforcement
8. Write tests for `vector/`, `logger/`, `utils/`, `events/` modules
9. Triage and re-enable the 62 skipped tests

### Long-term (Technical Debt)
10. Reduce `any` type usage, starting with `workflows/workflow.ts` (62) and `agent-legacy.ts` (45)
11. Address the 55 TODO comments, starting with unclear type errors
12. Standardize dependency versions via pnpm catalog
