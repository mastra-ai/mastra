# New internal capability (no public surface)

**Reviewing:** architectural fit.
**Read first:** the closest sibling feature, side by side with the new one.
**Done means:** uses the same primitives and layers as the sibling; hooks into what it should; nothing reinvented.
**Trap:** reinvented wheel; bypassed layer.
**Attention:** the seams — where the new code touches the existing system. The internals of the new code matter less than what it goes through and around.

## Questions

- **Find the sibling.** Whatever this does, something similar exists. Read how _it_ does it. Same primitives, or a second event bus / retry loop / cache / helper that exists three directories over? Reinvention is the #1 sign of not knowing the internals.
- **Trace one call end-to-end.** Main entry point to the bottom, every layer. It should go through what everything else goes through (validation, logging, tracing, storage abstraction) rather than around. The bypass is invisible in the diff — it's the _absence_ of a call — so you have to trace, not read.
- **What should it have hooked into?** Lifecycle hooks, middleware, processors, registries, cleanup. Capability that doesn't register is invisible to observability, plugins, teardown.
- **Which existing code did the author model this on?** A good answer names a file. No answer means they didn't look.
- **Should this exist, and here?** Do we want to own this? Does it belong in this package, this layer? Would an example or a plugin have served?
- **Is it over-built?** Abstraction with one caller, options no caller sets, a registry for two entries, indirection between two things that could talk directly. What does it buy _today_?
- **What does this assume, and where is it enforced?** "Always called after init," "never concurrent." Name it; find the enforcement.
- **Resource lifecycle.** Handles, listeners, timers, subscriptions, child processes — everything opened must be closed. Leaks don't show in tests.
- **What will the next PR in this area need?** Does this make it easier or harder? Abstractions that fit one use case make the second worse.
- **Tests as spec.** Cover the implementation, read only the tests — can you reconstruct what it does? Tests of implementation details ("calls internal helper with args") break on refactor and catch no bugs.

## Signals → branches

- A helper/utility added that has a near-twin in the repo → grep for the twin; request consolidation; two implementations of one thing will diverge
- Entry point doesn't pass through the layer the sibling does → request routing through the layer before merge unless the author can justify the bypass
- No sibling exists → the "should this exist" question gets more weight, and the design review is on you — compare against the three closest things anyway
- "Extensible," "pluggable," "generic" in the description → over-built check
- Opens something (listener, timer, stream) with no matching close → trace teardown

## Verify

- Compare the sibling's entry point with the new one; record only divergences that affect the review.
- Trace the layers the sibling's call passes through and confirm the important ones on the new path with pointers.
- Grep for near-twin helpers: `archaeology.md` → Callers / twin search.
- If it's exercisable without a public surface (internal test harness, existing example), run it.
