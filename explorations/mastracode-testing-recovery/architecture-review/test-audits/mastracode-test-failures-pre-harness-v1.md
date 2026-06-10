# Mastra Code test failure inventory — pre-Harness v1 baseline

Generated: 2026-06-03T16:50:00

## Baseline commit

Pre-Harness v1 checkout:

```text
3abcdd2da7c3c5a4b6d49e39beaf29c7d39d0f16 chore(core): rename legacy harness class
```

This is the parent of the first Harness v1 scaffold commit on this branch:

```text
8550d38d14c18778c45ad76f139e206a5e975a31 feat(core): add harness v1 subpath scaffold (#16818)
```

Detached worktree used for the run:

```text
/tmp/mastra-pre-harness-v1
```

## Setup

The old checkout required pnpm `10.29.3`, so I activated it through Corepack:

```sh
corepack prepare pnpm@10.29.3 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm run build:mastracode
```

Build result:

```text
22 successful / 22 total
```

Then ran tests:

```sh
cd /tmp/mastra-pre-harness-v1/mastracode
corepack pnpm test -- --run --reporter=verbose 2>&1 | tee /tmp/mastracode-vitest-pre-harness.log
```

Raw log:

```text
/tmp/mastracode-vitest-pre-harness.log
```

## Summary

- Test files: **3 failed**, **90 passed** (**93 total**)
- Tests: **5 failed**, **976 passed** (**981 total**)
- Failed import-time suites: **1**
- Failed test cases: **5**

## Failed import-time suite

1. `src/tui/__tests__/setup-keyboard-shortcuts.test.ts`
   - Error: `[vitest] No "Container" export is defined on the "@mariozechner/pi-tui" mock. Did you forget to return it from "vi.mock"?`
   - Stack source: `src/tui/components/idle-counter.ts:12:41`
   - Import path: `src/tui/setup.ts:16:1`
   - Likely area: stale/insufficient `@mariozechner/pi-tui` mock in this test file after `IdleCounterComponent extends Container` enters the import graph.

## Failed test cases

1. `src/headless-integration.test.ts > headless mode — event-driven auto-resolution > can abort a running agent and receive agent_end with aborted reason`
   - Error: `Test timed out in 30000ms.`
   - Location: `src/headless-integration.test.ts:227:3`
   - Note: this failure exists **before Harness v1**, so the same HEAD failure is not newly introduced by the Harness v1 migration.

2. `src/headless-integration.test.ts > headless mode — event-driven auto-resolution > AgentsMDInjector persists a system reminder after instruction-file tool usage`
   - Error: `expected 0 to be greater than 0`
   - Location: `src/headless-integration.test.ts:343:46`
   - Assertion: `persistedReminderMessages.length` should be greater than `0`, but no persisted reminder messages were found.
   - Note: this pre-Harness failure does **not** appear in the current HEAD audit, so it may have been fixed later.

3. `src/agents/__tests__/model.test.ts > resolveModel > openai/* models > uses model router when no OpenAI auth is configured`
   - Error: `expected 'openai-direct' to be 'model-router'`
   - Location: `src/agents/__tests__/model.test.ts:290:33`
   - Likely area: local OpenAI environment credentials leak into the test and make routing choose direct OpenAI instead of the model router.

4. `src/agents/__tests__/model.test.ts > getOpenAIApiKey > returns undefined when no API key is available`
   - Error: expected `undefined`, received a real local `sk-proj-...` OpenAI API key from the environment.
   - Location: `src/agents/__tests__/model.test.ts:662:31`
   - Likely area: test does not isolate provider environment variables.

5. `src/agents/__tests__/model.test.ts > getOpenAIApiKey > returns undefined when stored credential is OAuth type`
   - Error: expected `undefined`, received a real local `sk-proj-...` OpenAI API key from the environment.
   - Location: `src/agents/__tests__/model.test.ts:667:31`
   - Likely area: same environment leakage as above.

## Root-cause buckets

- **OpenAI env leakage / model routing test isolation**: 3
- **Headless abort lifecycle timeout, pre-existing**: 1
- **AgentsMDInjector reminder persistence failure, pre-existing baseline only**: 1
- **Vitest mock drift for `@mariozechner/pi-tui.Container`**: 1 suite

## Comparison to current HEAD audit

Current HEAD audit file:

```text
explorations/mastracode-testing-recovery/architecture-review/test-audits/mastracode-test-failures-HEAD.md
```

Pre-Harness baseline:

```text
explorations/mastracode-testing-recovery/architecture-review/test-audits/mastracode-test-failures-pre-harness-v1.md
```

Key comparison:

- The headless abort timeout was already failing before Harness v1.
- The OpenAI/model-routing failures were already failing before Harness v1 and are environment-test-isolation issues.
- The pre-Harness `AgentsMDInjector persists a system reminder...` failure is no longer present at HEAD.
- The pre-Harness `setup-keyboard-shortcuts.test.ts` import-suite failure changed shape by HEAD:
  - Pre-Harness: missing `@mariozechner/pi-tui` mock export `Container`.
  - HEAD: the import suite passes, but a keyboard autocomplete assertion fails because `/github` now includes `sync`.
- HEAD has new failures not present in the pre-Harness baseline:
  - `src/tui/__tests__/mastra-tui-hooks.test.ts` import suite: `node:child_process` mock missing `execFile`.
  - `src/tui/__tests__/goal-manager.test.ts`: goal judge stream call-shape expectation drift.
