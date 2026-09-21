# Performance

**Reviewing:** numbers.
**Read first:** the benchmark and its input shape — before the code change.
**Done means:** before/after measured on a representative input; behavior unchanged; the win is where the description says it is.
**Trap:** faster on a toy input; correctness quietly changed to get the number.
**Attention:** the measurement first, then equivalence. A perf PR is a refactor with a number attached — it has to pass the refactor bar _and_ show the number.

## Questions

- **What's n in production?** Not "is it O(n)" — what's the real input size and shape? A win at 50 items that regresses at 50k, or vice versa, is a loss.
- **Is this the hot path?** An extra allocation per token matters; in setup it doesn't. Conversely, an optimization off the hot path is complexity for nothing.
- **What was measured, how, on what?** Wall clock? Allocations? Under load? Cold or warm? One run or many? Was the baseline measured the same way, on the same machine, same session?
- **Did behavior change?** Perf PRs remove work. Was any of that work load-bearing — an ordering guarantee, a validation, a flush? Apply the refactor questions: tests unchanged, deletions justified.
- **Is the complexity worth the number?** A 3% win that adds a cache with invalidation logic is a net loss in maintenance. Ask what the number _buys_ a user.
- **Does the win survive the real environment?** Node version, bundler, the actual storage backend, network in the loop.
- **Caches and memoization.** Invalidation, memory growth, key collisions, behavior when the cache is cold.
- **Is there a simpler win?** Sometimes the measured bottleneck is one line away from a trivial fix and the PR built a subsystem around it.

## Signals → branches

- No numbers in the description → the claim is unverified; ask for the benchmark or run one
- Numbers but no input description → run at 10× and 100× the likely input; report both
- Tests changed → re-categorize as behavior change; the number may have been bought with correctness
- A cache or memo introduced → invalidation and memory questions; look for the test that exercises invalidation
- "Should be faster" without measurement → inferred; not a perf PR until measured

## Verify

- **Reproduce the measurement** on base and branch with the same harness and input. `hyperfine` works for CLI-shaped things; a scripted loop can measure library calls. Record the method and material result.
- **Scale the input** to production shape and re-run.
- Refactor verification: tests untouched (`git diff <base>...HEAD --stat -- '**/*.test.*'` empty), suite green.
- If a cache was added: write a case that invalidates and confirm behavior.
