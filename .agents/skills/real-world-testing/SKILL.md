---
name: real-world-testing
description: Use when fixing a bug, writing or reviewing tests, or adding a regression test anywhere in Mastra (core, storage adapters, server adapters, memory, client SDKs, integrations). Especially use before mocking a class, model, storage, or server; before writing a unit test that only checks wiring or that a value is defined; before writing a one-off test for a single engine, adapter, or code path; before adding a recorded (__recordings__) fixture; or when a test passes but you aren't sure it reproduces the real failure.
---

# Real-world testing

Tests exist to make Mastra work for the people building on it. A test earns its place only if it would have caught a bug a user hit, or will catch the next one. A test that passes while the real app is broken is worse than no test: it says things are fine, it costs time to run and maintain, and it breaks on harmless refactors.

Every test you add should answer: **what real failure does this protect against?** If you can't name one, don't write the test.

## Tests that don't earn their place

Don't write these. When you find them next to code you're changing, replace or delete them.

- **Smoke tests that assert nothing real**: `expect(result.runId).toBeDefined()`, `expect(fn).not.toThrow()`, "it returns something".
- **Mock-echo tests**: mock a dependency, call the code, then assert the mock was called with what you passed in. This tests the mock, not the behavior.
- **Implementation mirrors**: tests that restate the code line by line (private helpers, internal call order, exact intermediate objects). They break on every refactor and catch no user-facing bug.
- **Mocked-out boundaries**: `vi.fn()` storage, stubbed `fetch`, fake `Mastra` or agent classes, mocked processors. The bug usually lives in the code you mocked away.
- **Single-path copies**: the same case rewritten for one engine, adapter, or provider, so a fix in one path never gets checked in the others.
- **Snapshots of internals** nobody reads when they change.

Unit tests are fine for pure logic with real edge cases (a parser, a schema converter, a scheduling or retry calculation) where inputs and outputs are the contract. Test those inputs and outputs, not the steps in between.

## Principles

1. **Start from the user's situation.** Write the test as the case a user hits: a support agent approves a refund, a reply is cut off by a dropped connection, a message saved in Postgres comes back in the wrong order, a request through the Express adapter loses its auth context. Name tests by what the user sees. Put the mechanism in a comment, with the issue number.
2. **Use real infrastructure. Don't mock the thing you're testing.** Real HTTP over a socket instead of a stubbed fetch. Real storage (in-memory, local, or the adapter's Docker database) instead of `vi.fn()` stores. A real Inngest dev server for Inngest. Real processors, tools, `Mastra` instances, and the public API. Mock only at the outermost edge you can't run (a paid LLM, a third-party API), and mock it at the wire level so everything inside runs for real.
3. **Reproduce before you fix.** Get a failing test through the public API that fails the way the user saw it. If a test only fails inside a harness, or only with internals poked, you haven't proven the bug yet. Find out which difference triggers it. Timing bugs need repetition: run them 20–40 times, not once.
4. **Prove the test catches the bug.** Run it against the pre-fix commit (or with the fix reverted) and confirm it fails on the assertion you mean, not on setup. A test that never failed proves nothing. For moved or consolidated tests, break the behavior on purpose and confirm the new test fails.
5. **Prove the fix is real, not just green.** Check that you fixed the cause, not the symptom. Show that legitimate behavior next to the bug still works (for example, ignoring a stale event must not ignore a real one). Temporary logging to confirm what happens is fine. Remove it before committing.
6. **Cover every path the bug can take.** Mastra often has several ways to do the same thing: Agent vs DurableAgent vs evented vs Inngest, stream vs generate, first run vs resume, in-process vs across a process boundary, one storage adapter vs another, one server adapter vs another. Most bugs come from a fix in one path that's missing in the others. Test all of them, ideally through one shared suite.
7. **Assert on what crossed the boundary.** Check what the model actually received, what was persisted and read back, what the next process loaded, what went over the wire. Not only the final return value.
8. **Keep known bugs visible.** If a case fails on one path because of a real bug, keep it and mark it expected-to-fail (`it.fails`) with a comment. Only write a cause if you've verified it; otherwise say "not yet investigated". Only pin deterministic failures: run the case several times first. If it passes some runs and fails others, use `it.skip` with a comment saying the result is nondeterministic. Never delete or skip a deterministically failing case to get green. File an issue for real bugs you find along the way.
9. **No recordings matched by hash.** They break on any byte change (model-written ids, test order) and bake bugs into fixtures. Script responses by request shape instead.
10. **Consolidate.** One shared suite that runs every path beats ten one-off tests. When your test replaces older ones, delete them in the same PR, with a list of what was deleted and what now covers it.

## Where real-world tests live

Add to the shared suite for the area before writing a standalone file.

| Area                                                                                                                                         | Shared suite                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Agent behavior in `@mastra/core` (loop, streaming, tools, approval/suspend/resume, processors, memory threads, subagents, structured output) | aimock scenarios, below                                                                                               |
| Storage adapters (`stores/*`)                                                                                                                | `createTestSuite` from `@internal/storage-test-utils` (`stores/_test-utils`), run against the adapter's real database |
| Server adapters (`server-adapters/*`)                                                                                                        | `server-adapters/server-adapters-test-suite`, over real HTTP                                                          |

If an area has no shared suite and the same case would apply to several implementations, write the case once in a reusable form instead of copying it per implementation.

## Agent behavior in @mastra/core: aimock scenarios

Scenarios live in `packages/core/src/loop/test-utils/aimock/scenarios/*.scenario.test.ts`. Read `packages/core/src/loop/test-utils/aimock/README.md` for the full API. Don't write `durable-agent-*.test.ts` one-offs or new recorded e2e cases for agent behavior.

Scenarios run against a real HTTP mock LLM (`@copilotkit/aimock`). From `packages/core`, `describeForAllEngines` runs each scenario on `normal`, `durable`, `evented`, and `fs`. The `workflows/inngest` project runs the same scenarios on `inngest` only, against a real dev server. Full coverage needs both commands.

```ts
describeForAllEngines('Support agent ...', engine => {
  const getMock = useLoopScenarioAimock();
  const itFailsOnInngest = engine === 'inngest' ? it.fails : it;

  // Technical: <mechanism>. (#12345)
  it('<what the user sees> (#12345)', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: '...',
      tools,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: '...' });
      },
    });
    expect(output.text).toBe('...');
    expect(JSON.stringify(requests[1].body.messages)).toContain('...');
  });
});
```

Harness notes:

- `createSharedAgent` keeps one agent across calls (suspend/resume, multi-turn). `runApprovalScenario` drives approvals on every engine.
- Pick fixtures with `sequenceIndex`, `toolName`, `toolCallId`, `hasToolResult`, message regexes, or a `predicate`.
- The model sees tool names from the `tools` object keys, not the tool `id`. Auto-resume fixtures must include `suspendedToolCallId`.
- Tests of engine internals with no effect the model or user can see (leases, recovery, execution fences, thread runtime timing) stay in focused test files next to that code.

Running:

```sh
# In-process engines, seconds. Use while iterating.
cd packages/core && npx vitest run src/loop/test-utils/aimock/scenarios/<name>.scenario.test.ts

# Inngest, real dev servers. Targeted only; a full run is ~90s, don't repeat it casually.
cd workflows/inngest && AIMOCK_SCENARIOS='{name-a,name-b}' npx vitest run --project e2e:workflows/inngest:aimock
```

Run a new scenario file on Inngest once and pin anything that diverges.

## Before you finish

- [ ] Each test protects against a real failure you can name
- [ ] The test is a real user situation, through the public API, on real infrastructure
- [ ] It fails without the fix, on the intended assertion
- [ ] Every path the bug can take is covered (engines, stream/generate, resume, adapters)
- [ ] Neighboring legitimate behavior is still verified
- [ ] Deterministic divergences are pinned with `it.fails`, nondeterministic ones skipped, each with an honest comment; real bugs found are filed
- [ ] Low-value tests you replaced (smoke, mock-echo, one-offs, recordings) are deleted; debug logging removed
