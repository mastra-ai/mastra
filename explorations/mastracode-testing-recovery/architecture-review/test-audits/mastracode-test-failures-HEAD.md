# Mastra Code test failure inventory — post-build

Generated: 2026-06-03T16:42:00

## Setup

I deleted the earlier invalid inventory and rebuilt the package graph first:

```sh
pnpm run build:mastracode
```

Build result: **23 successful / 23 total**.

Then reran Mastra Code tests:

```sh
cd mastracode
pnpm test -- --run --reporter=verbose 2>&1 | tee /tmp/mastracode-vitest-postbuild.log
```

Raw log: `/tmp/mastracode-vitest-postbuild.log`

## Summary

- Test files: **5 failed**, **103 passed** (**108 total**)
- Tests: **6 failed**, **1221 passed** (**1227 total**)
- Failed import-time suites: **1**
- Failed test cases: **6**

## Failed import-time suite

1. `src/tui/__tests__/mastra-tui-hooks.test.ts`
   - Error: `[vitest] No "execFile" export is defined on the "node:child_process" mock. Did you forget to return it from "vi.mock"?`
   - Stack source: `src/github-signals/index.ts:21:33`
   - Import path: `src/tui/commands/github.ts:3:1`
   - Why it matters: this is mock drift. The test mocks `node:child_process`, but newer GitHub signals code imports `execFile`, so the mock no longer satisfies the module surface.

## Failed test cases

1. `src/headless-integration.test.ts > headless mode — event-driven auto-resolution > can abort a running agent and receive agent_end with aborted reason`
   - Error: `Test timed out in 30000ms.`
   - Location: `src/headless-integration.test.ts:227:3`
   - Likely area: headless abort / event-driven auto-resolution path. This one is suspicious for Harness v1 runtime behavior because the test expects an abort to surface as `agent_end` with aborted reason, but the run never settles.

2. `src/agents/__tests__/model.test.ts > resolveModel > openai/* models > uses model router when no OpenAI auth is configured`
   - Error: `expected 'openai-direct' to be 'model-router'`
   - Location: `src/agents/__tests__/model.test.ts:290:33`
   - Likely area: `resolveModel('openai/gpt-4o')` is detecting local OpenAI credentials and choosing direct OpenAI routing instead of the model router.

3. `src/agents/__tests__/model.test.ts > getOpenAIApiKey > returns undefined when no API key is available`
   - Error: expected `undefined`, received a real local `sk-proj-...` OpenAI key from the environment.
   - Location: `src/agents/__tests__/model.test.ts:662:31`
   - Likely area: environment leakage into tests. The test mocks auth storage but does not isolate `process.env.OPENAI_API_KEY` / related provider env.

4. `src/agents/__tests__/model.test.ts > getOpenAIApiKey > returns undefined when stored credential is OAuth type`
   - Error: expected `undefined`, received a real local `sk-proj-...` OpenAI key from the environment.
   - Location: `src/agents/__tests__/model.test.ts:667:31`
   - Likely area: same environment leakage as above.

5. `src/tui/__tests__/goal-manager.test.ts > GoalManager > uses stream with structured output and judge memory thread parent-goalId`
   - Error: `expected "vi.fn()" to be called with arguments...`
   - Location: `src/tui/__tests__/goal-manager.test.ts:338:26`
   - Difference observed:
     - Prompt string did include the expected latest-assistant-message content.
     - Options now include `abortSignal: undefined`, `maxSteps: 50`, and `structuredOutput.errorStrategy: "warn"` with a concrete Zod object.
     - Test expected a narrower `expect.objectContaining({ structuredOutput: { schema: Any<Object> } })` shape.
   - Likely area: goal judge stream options changed; probably test expectation drift unless the exact call shape is contractually important.

6. `src/tui/__tests__/setup-keyboard-shortcuts.test.ts > setupKeyboardShortcuts > defaults slash-command autocomplete to the first visible built-in command before custom commands`
   - Error: expected `["subscribe", "unsubscribe", "debug"]`, received `["subscribe", "unsubscribe", "sync", "debug"]`
   - Location: `src/tui/__tests__/setup-keyboard-shortcuts.test.ts:144:87`
   - Likely area: `/github` command autocomplete now exposes `sync`; test fixture is stale if `sync` is intentional.

## Root-cause buckets

- **Harness/headless abort lifecycle**: 1
- **OpenAI env leakage / model routing test isolation**: 3
- **Vitest mock drift for `node:child_process.execFile`**: 1 suite
- **Goal judge stream call-shape expectation drift**: 1
- **GitHub autocomplete fixture drift**: 1

## Notes

- The previous import-resolution inventory was invalid because Mastra Code and its workspace package dependencies had not been built first.
- After `pnpm run build:mastracode`, all `@mastra/core/*`, `@mastra/libsql`, `@mastra/duckdb`, `@mastra/schema-compat`, `@mastra/mcp`, and `@mastra/stagehand` resolution failures disappeared.
- The remaining suspicious Harness-v1-specific failure is the headless abort timeout. The rest look like test isolation or stale expectations, pending code review.
