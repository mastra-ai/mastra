# Mastra Code test failures: pre-Harness v1 vs HEAD

## Headline

This audit did **not** find a convincing Harness v1 regression caught by the existing Mastra Code tests.

The failures that look most Harness-adjacent are either pre-existing (`headless-integration.test.ts` abort timeout), caused by local environment leakage (`model.test.ts` OpenAI credentials), or look like test/mock/fixture drift at HEAD (`execFile` mock gap, GoalManager stream option shape, `/github sync` autocomplete). In other words: the comparison mostly shows that the suite is noisy and needs cleanup before it can prove Harness v1 broke real behavior.

## Sources

- Pre-Harness v1 audit: `explorations/mastracode-testing-recovery/architecture-review/test-audits/mastracode-test-failures-pre-harness-v1.md`
- HEAD audit: `explorations/mastracode-testing-recovery/architecture-review/test-audits/mastracode-test-failures-HEAD.md`
- Pre-Harness raw log: `/tmp/mastracode-vitest-pre-harness.log`
- HEAD raw log: `/tmp/mastracode-vitest-postbuild.log`

## Commits compared

### Pre-Harness v1 baseline

```text
3abcdd2da7c3c5a4b6d49e39beaf29c7d39d0f16 chore(core): rename legacy harness class
```

This is the parent of the first Harness v1 scaffold commit on this branch:

```text
8550d38d14c18778c45ad76f139e206a5e975a31 feat(core): add harness v1 subpath scaffold (#16818)
```

### HEAD

Current branch HEAD at audit time, after running:

```sh
pnpm run build:mastracode
pnpm test:mastracode -- --run --reporter=verbose
```

## Setup notes

Both audits were run after building Mastra Code and its workspace dependency graph.

Pre-Harness v1 required the older pinned package manager:

```sh
corepack prepare pnpm@10.29.3 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm run build:mastracode
```

HEAD used the current workspace setup:

```sh
pnpm run build:mastracode
```

## Summary comparison

| Audit | Failed files | Passed files | Total files | Failed tests | Passed tests | Total tests |
|---|---:|---:|---:|---:|---:|---:|
| Pre-Harness v1 | 3 | 90 | 93 | 5 | 976 | 981 |
| HEAD | 5 | 103 | 108 | 6 | 1221 | 1227 |

HEAD has more tests overall, so the raw counts are not directly comparable as a regression count. The useful signal is the identity of failures.

## Failures present in both audits

These failures existed before Harness v1 and still exist at HEAD. They should not be attributed to the Harness v1 migration without additional evidence.

### 1. Headless abort lifecycle timeout

Test:

```text
src/headless-integration.test.ts > headless mode — event-driven auto-resolution > can abort a running agent and receive agent_end with aborted reason
```

Failure in both audits:

```text
Error: Test timed out in 30000ms.
```

Location in both audits:

```text
src/headless-integration.test.ts:227:3
```

Conclusion: this timeout is pre-existing. It is still worth fixing, but it is not newly introduced by Harness v1.

### 2. OpenAI model routing chooses direct OpenAI

Test:

```text
src/agents/__tests__/model.test.ts > resolveModel > openai/* models > uses model router when no OpenAI auth is configured
```

Failure in both audits:

```text
expected 'openai-direct' to be 'model-router'
```

Location:

```text
src/agents/__tests__/model.test.ts:290:33
```

Conclusion: this is caused by local OpenAI credentials leaking into the test environment. It is not Harness-v1-specific.

### 3. `getOpenAIApiKey` returns local env key when test expects undefined

Test:

```text
src/agents/__tests__/model.test.ts > getOpenAIApiKey > returns undefined when no API key is available
```

Failure in both audits:

```text
expected undefined, received a real local sk-proj-... OpenAI API key
```

Location:

```text
src/agents/__tests__/model.test.ts:662:31
```

Conclusion: environment leakage.

### 4. `getOpenAIApiKey` returns local env key when stored credential is OAuth

Test:

```text
src/agents/__tests__/model.test.ts > getOpenAIApiKey > returns undefined when stored credential is OAuth type
```

Failure in both audits:

```text
expected undefined, received a real local sk-proj-... OpenAI API key
```

Location:

```text
src/agents/__tests__/model.test.ts:667:31
```

Conclusion: same environment leakage.

## Failures only in the pre-Harness v1 baseline

These failures were present before Harness v1 and are no longer present at HEAD.

### 1. AgentsMDInjector reminder persistence

Test:

```text
src/headless-integration.test.ts > headless mode — event-driven auto-resolution > AgentsMDInjector persists a system reminder after instruction-file tool usage
```

Pre-Harness failure:

```text
AssertionError: expected 0 to be greater than 0
```

Location:

```text
src/headless-integration.test.ts:343:46
```

What failed:

```text
persistedReminderMessages.length
```

HEAD status: this exact test still exists and no longer fails in the HEAD audit.

Conclusion: this was fixed sometime between the pre-Harness baseline and HEAD. It was not removed.

### 2. `setup-keyboard-shortcuts.test.ts` import-time mock failure

Pre-Harness failed suite:

```text
src/tui/__tests__/setup-keyboard-shortcuts.test.ts
```

Pre-Harness failure:

```text
[vitest] No "Container" export is defined on the "@mariozechner/pi-tui" mock.
```

Stack source:

```text
src/tui/components/idle-counter.ts:12:41
src/tui/setup.ts:16:1
```

HEAD status: the import-time suite failure is gone. The same file now runs and fails on a different assertion about `/github` completions.

Conclusion: the mock/import setup improved after the baseline, but the test now exposes a separate behavior/fixture drift.

## Failures only at HEAD

These failures are new relative to the pre-Harness v1 baseline audit.

### 1. `mastra-tui-hooks.test.ts` import-time mock failure

HEAD failed suite:

```text
src/tui/__tests__/mastra-tui-hooks.test.ts
```

HEAD failure:

```text
[vitest] No "execFile" export is defined on the "node:child_process" mock.
```

Stack source:

```text
src/github-signals/index.ts:21:33
src/tui/commands/github.ts:3:1
```

Likely cause: GitHub signals now imports `execFile`, but this test's `node:child_process` mock does not provide it.

Classification: test mock drift, not necessarily product behavior regression.

### 2. GoalManager stream call-shape expectation drift

HEAD failed test:

```text
src/tui/__tests__/goal-manager.test.ts > GoalManager > uses stream with structured output and judge memory thread parent-goalId
```

HEAD failure:

```text
expected "vi.fn()" to be called with arguments...
```

Location:

```text
src/tui/__tests__/goal-manager.test.ts:338:26
```

Observed difference:

- Prompt string still includes the expected latest-assistant-message content.
- Options now include:
  - `abortSignal: undefined`
  - `maxSteps: 50`
  - `structuredOutput.errorStrategy: "warn"`
  - concrete Zod object for the schema

Likely cause: stream call options changed while the test still expects the older/narrower shape.

Classification: likely test expectation drift unless the exact option shape is part of the contract.

### 3. `/github` autocomplete includes `sync`

HEAD failed test:

```text
src/tui/__tests__/setup-keyboard-shortcuts.test.ts > setupKeyboardShortcuts > defaults slash-command autocomplete to the first visible built-in command before custom commands
```

HEAD failure:

```text
Expected: ["subscribe", "unsubscribe", "debug"]
Received: ["subscribe", "unsubscribe", "sync", "debug"]
```

Location:

```text
src/tui/__tests__/setup-keyboard-shortcuts.test.ts:144:87
```

Likely cause: `/github sync` became a visible command option, but the test fixture was not updated.

Classification: likely fixture drift if `sync` is intentional.

## Net change by category

| Category | Pre-Harness v1 | HEAD | Net |
|---|---:|---:|---:|
| Pre-existing headless abort timeout | 1 | 1 | unchanged |
| OpenAI env leakage/model-routing isolation | 3 | 3 | unchanged |
| AgentsMDInjector reminder persistence | 1 | 0 | fixed by HEAD |
| `setup-keyboard-shortcuts` import mock failure | 1 suite | 0 | fixed by HEAD |
| `mastra-tui-hooks` child_process mock failure | 0 | 1 suite | new at HEAD |
| GoalManager stream call-shape expectation | 0 | 1 | new at HEAD |
| GitHub autocomplete includes `sync` | 0 | 1 | new at HEAD |

## Bottom line

The current HEAD failures are not a clean signal that Harness v1 broke headless abort behavior, because the headless abort timeout already failed before Harness v1.

The meaningful HEAD-only differences are:

1. a new `node:child_process.execFile` mock gap in `mastra-tui-hooks.test.ts`,
2. a new GoalManager stream call-shape expectation mismatch,
3. a new `/github sync` autocomplete assertion mismatch.

The pre-Harness baseline also had failures that HEAD appears to have fixed:

1. AgentsMDInjector persisted reminder assertion,
2. `@mariozechner/pi-tui.Container` mock/import failure in `setup-keyboard-shortcuts.test.ts`.

Recommended next step: fix or quarantine the stable environment/test-isolation failures first, especially the OpenAI env leakage, so future Harness-related audits are not polluted by local developer credentials.
