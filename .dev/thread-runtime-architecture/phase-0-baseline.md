# Phase 0 baseline record

Baseline commit: `bff80049cc0` (`fix: await thread stream registration`) on branch `fix/same-run-tool-resume-subscriptions`.

Phase 0 intentionally makes no production behavior changes. The reset baseline already contains focused tests that capture the important passing and failing behavior, so this phase records that baseline instead of committing additional failing tests outside their fixing phases.

## Focused baseline results

Commands below were run from the repository root. The plan examples use root-relative test paths, but Vitest is executed with `packages/core` as its working directory in this checkout, so the equivalent package-relative `src/...` paths were used.

### Passing protective tests

```bash
pnpm --filter ./packages/core test -- --run src/agent/__tests__/agent-signals.test.ts --bail 1 --reporter=dot
```

Result: passed (`77 passed`).

Covers current subscriber behavior, including same-run re-enqueue via `seenRunIds.delete(runId)`.

```bash
pnpm --filter ./packages/core test -- --run src/harness/__tests__/harness-tool-suspension.test.ts --bail 1 --reporter=dot
```

Result: passed (`5 passed`).

Covers current Harness generic tool suspension/resume behavior, including the architectural smell that Harness calls `resumeStream()` for generic suspended-tool resume and intentionally does not consume the returned stream.

### Known red baseline fixtures

```bash
pnpm --filter ./packages/core test -- --run src/agent/__tests__/stream.test.ts --bail 1 --reporter=dot
```

Result: failed at `src/agent/__tests__/stream.test.ts:49` in `v2 - stream > should persist the full message after a successful run`.

Observed failure:

```text
AssertionError: expected undefined to be true
```

This captures the direct stream ownership bug: direct `agent.stream()` consumption is not reliably producing/persisting the expected assistant parts at the reset baseline.

```bash
pnpm --filter ./packages/core test -- --run src/harness/__tests__/harness-ask-user.test.ts --bail 1 --reporter=dot
```

Result: failed at `src/harness/__tests__/harness-ask-user.test.ts:344` in `surfaces three ask_user questions one at a time across resumes (#13642 serialized flow)`.

Observed failure:

```text
AssertionError: expected [] to deeply equal [ 'call-size' ]
```

This captures the resumed subscription delivery bug: after the first `ask_user` resume, the next suspension event is not synchronously visible to Harness listeners before `respondToToolSuspension()` returns.

## Phase mapping

- Phase 1 should turn the `stream.test.ts` direct-consumer fixture green without stealing returned direct streams.
- Phases 3–6 should turn the serialized `ask_user` resume fixture green through first-class suspension state, correct subscriber boundaries, and `sendStreamResume()` rather than timing sleeps.
- Later signal/TUI phases should add their own focused fixtures before touching UI/E2E surfaces.
