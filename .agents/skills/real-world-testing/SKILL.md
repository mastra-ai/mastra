---
name: real-world-testing
description: Use when fixing a bug, writing or reviewing tests, or adding a regression test anywhere in Mastra. Especially use before mocking a class, model, storage, or server; before writing a one-off test for a single engine or code path; before adding a recorded (__recordings__) fixture; or when a test passes but you aren't sure it reproduces the real failure. Covers agent behavior tests in @mastra/core via the aimock scenario suite.
---

# Real-world testing

Tests exist to make Mastra work for the people building on it. A test earns its place if it would have caught a bug a user hit, or will catch the next one. A test that passes while the real app is broken is worse than no test, because it says things are fine.

## Principles

1. **Start from the user's situation.** Write the test as the case a user hits: a support agent approves a refund, a reply is cut off by a dropped connection, a customer answers a suspended question on the same thread. Name tests by what the user sees. Put the mechanism in a comment, with the issue number.
2. **Use real infrastructure. Don't mock the thing you're testing.** Real HTTP over a socket instead of a stubbed fetch. Real storage adapters (in-memory or local) instead of `vi.fn()` stores. A real Inngest dev server for Inngest. Real processors, real tools, real `Mastra` instances, the public API. Mock only at the outermost edge you can't run (a paid LLM, a third-party API), and mock it at the wire level so everything inside runs for real.
3. **Reproduce before you fix.** Get a failing test through the public API that fails the way the user saw it. If a test only fails inside the harness, or only with internals poked, you haven't proven the bug yet. Find out which difference triggers it. Timing bugs need repetition: run it 20–40 times, not once.
4. **Prove the test catches the bug.** Run it against the pre-fix commit (or with the fix reverted) and confirm it fails on the assertion you mean, not on setup. A test that never failed proves nothing.
5. **Prove the fix is real, not just green.** Check that you fixed the cause, not the symptom. Show that legitimate behavior next to the bug still works (e.g. ignoring a stale event must not ignore a real one). Temporary logging to confirm what happens is fine. Remove it before committing.
6. **Cover every path the bug can take.** Mastra has several ways to run the same thing: Agent vs DurableAgent vs evented vs Inngest, stream vs generate, first run vs resume, in-process vs across a process boundary. Most bugs come from a fix in one path that's missing in the others. Test all of them.
7. **Assert on what crossed the boundary.** Check what the model actually received, what was persisted, what the next process loaded, not only the final output.
8. **Keep known bugs visible.** If a case fails on one path because of a real bug, keep it and mark it expected-to-fail (`it.fails`) with a comment. Only write a cause if you've verified it, otherwise say "not yet investigated". Never delete or skip a failing case to get green. File an issue for real bugs you find along the way.
9. **No recordings matched by hash.** They break on any byte change (model-written ids, test order) and bake bugs into fixtures. Script responses by request shape instead.
10. **Consolidate.** One shared suite beats ten one-off tests for single paths. When your test replaces older ones, delete them in the same PR.

## Agent behavior in @mastra/core: aimock scenarios

Agent loop, streaming, tools, approval/suspend/resume, processors, memory, subagents, and structured output tests go in `packages/core/src/loop/test-utils/aimock/scenarios/*.scenario.test.ts`. Read `packages/core/src/loop/test-utils/aimock/README.md` for the full API.

Scenarios run against a real HTTP mock LLM (`@copilotkit/aimock`), and `describeForAllEngines` runs each on `normal`, `durable`, `evented`, `fs`, plus `inngest` (real dev server) when run from `workflows/inngest`. Don't write `durable-agent-*.test.ts` one-offs or new recorded e2e cases for this.

```ts
describeForAllEngines('Support agent ...', engine => {
  const getMock = useLoopScenarioAimock();
  const itFailsOnInngest = engine === 'inngest' ? it.fails : it;

  // Technical: <mechanism>. (#12345)
  it('<what the user sees> (#12345)', async () => {
    const { output, requests } = await runLoopScenario({
      engine, llm: getMock(), prompt: '...', tools,
      fixtures: llm => { llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: '...' }); },
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

Running:
```sh
# In-process engines, seconds. Use while iterating.
cd packages/core && npx vitest run src/loop/test-utils/aimock/scenarios/<name>.scenario.test.ts

# Inngest, real dev servers. Targeted only; a full run is ~90s, don't repeat it casually.
cd workflows/inngest && AIMOCK_SCENARIOS='{name-a,name-b}' npx vitest run --project e2e:workflows/inngest:aimock
```
CI runs the Inngest project, so run a new scenario file there once and pin anything that diverges.

## Before you finish

- [ ] The test is a real user situation, through the public API, on real infrastructure
- [ ] It fails without the fix, on the intended assertion
- [ ] Every path the bug can take is covered (engines, stream/generate, resume)
- [ ] Neighboring legitimate behavior is still verified
- [ ] Known divergences are pinned with `it.fails` and an honest comment; real bugs found are filed
- [ ] Replaced one-off tests and recordings are deleted; debug logging removed
