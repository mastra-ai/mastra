# Tests only

No production code changes — new tests, changed tests, test infrastructure.

**Reviewing:** whether they'd catch anything.
**Read first:** the assertions.
**Done means:** the tests test what they claim; they'd fail if the feature broke; they're not flaky; they don't mock the thing they claim to test.
**Trap:** green-on-anything assertions.
**Attention:** the assertions and the mocks. Setup and structure are secondary.

## Questions

- **What does each assertion actually assert?** `toBeDefined()`, `toHaveBeenCalled()`, `not.toThrow()`, `toBeTruthy()` pass for almost any implementation. A real test asserts the _specific_ value or behavior.
- **Would it fail if the feature broke?** Mentally break the feature (return the wrong order, skip the write, swallow the error). Does the test go red? If not, it's a test of nothing.
- **Is the code under test the real code?** Count the mocks. If the module being tested is mocked, the test tests the mock.
- **Does the test name match what it does?** "handles concurrent writes" with one write; "validates input" with only the happy path.
- **Tests as spec.** Read only the tests — can you reconstruct the behavior? Tests of implementation details ("calls helper with args") break on refactor and catch no bugs.
- **What's _not_ tested?** The edge cases the feature has — empty, duplicate, concurrent, error path. The absence is the finding.
- **Flakiness.** Timing, ordering, shared state, real network, real clock. Anything that could pass and fail on the same code.
- **If a test was deleted or weakened:** why was it safe? A weakened assertion is a behavior change in disguise — the code can now do something it couldn't before without anyone noticing.
- **If a test was skipped or marked `todo`:** is there an issue? A skipped test is a claim the feature is untested.
- **Test infra changes** (helpers, fixtures, harness): who else uses them? Same caller grep as production code.

## Signals → branches

- Weak assertion → mentally break the feature; if the test stays green, finding
- Mocked module matches the module under test → finding; the test proves nothing
- Test deleted or assertion loosened → treat as a behavior change; find what it used to guard and whether that's still guarded
- `skip` / `todo` / `only` in the diff → ask why for each; `only` must be removed before merge (it disables the rest of the suite)
- Timing-based waits (`setTimeout` in a test) → flake candidate; run it five times

## Verify

- Run the changed tests on the branch; confirm green.
- **Mutation check**: when the test's value is uncertain, break the behavior it claims to cover in a scratch worktree, run the test, confirm red, and restore. Record the decisive result.
- Run new tests several times if there's any timing or shared state: `vitest run <file> --repeat 5` or a shell loop.
- `grep -rn "\.only(" <changed test files>`.
- If helpers/fixtures changed: `archaeology.md` → Callers for each.
