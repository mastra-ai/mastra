# Observational Memory token measurement plan

## Goal
Improve Observational Memory token counting in two phases:

1. **Phase 1:** replace `js-tiktoken` with a much cheaper local heuristic estimator (`tokenx`) while preserving OM's current part-level accumulation model.
2. **Phase 2:** add provider-backed grouped token measurement as an additional strategy for higher-fidelity counting near important threshold boundaries.

This sequence gives an immediate reduction in hot-path CPU and memory pressure without forcing the full provider-measurement architecture to land all at once.

## High-level rollout

### Phase 1: `tokenx` replaces `tiktoken`
Replace the current local text-tokenizer path with `tokenx` as the first step.

This should:

- preserve per-part counting,
- preserve current cache-driven accumulation,
- keep OM chunk-readiness behavior structurally the same,
- reduce the synchronous cost of text counting,
- avoid changing provider integration yet.

### Phase 2: provider-backed grouped counting
After the cheaper local estimator is in place, add provider-backed grouped counting using fake-fetch request capture and provider count endpoints.

This should:

- keep rough per-part estimation from phase 1,
- add exact provider measurement for grouped checkpoints,
- redistribute provider totals back to parts using rough-ratio weights,
- preserve `tokenx` as the rough estimator and fallback local path.

## Phase 1 details: replace `tiktoken` with `tokenx`

### Intended result
The current OM flow counts individual parts so chunk growth can be tracked incrementally. Phase 1 should keep that exact shape, but replace the expensive local text counting implementation.

### Current local-counting touchpoints to change
The primary `tiktoken` touchpoints currently live in:

- `packages/memory/src/processors/observational-memory/token-counter.ts:5-7`
  - imports `Tiktoken`, `TiktokenBPE`, and `o200k_base`
- `packages/memory/src/processors/observational-memory/token-counter.ts:19-28`
  - builds the global `__mastraTiktoken` singleton
- `packages/memory/src/processors/observational-memory/token-counter.ts:178-184`
  - `resolveEncodingId(...)` exists to tag cache keys by `tiktoken` encoding identity
- `packages/memory/src/processors/observational-memory/token-counter.ts:1121-1123`
  - class docs still describe the utility as using `tiktoken`
- `packages/memory/src/processors/observational-memory/__tests__/token-counter.test.ts:1`
  - tests import `o200k_base` directly

### Phase 1 implementation direction
1. Replace `js-tiktoken` text counting with `tokenx`.
2. Remove the global `__mastraTiktoken` singleton and encoding-specific cache labeling.
3. Keep the current part-level cache flow and message-total accumulation structure.
4. Keep the existing image/file/provider-aware heuristics intact for now.
5. Update tests that assume `o200k_base` or exact `tiktoken` behavior.
6. Update package dependencies accordingly.

### What phase 1 should not do
Phase 1 should **not**:

- add fake-fetch provider measurement yet,
- redesign OM thresholding logic,
- change part-level accumulation into group-only accumulation,
- change image/file behavior unless required by the `tokenx` swap.

### Why phase 1 is worth doing first
Phase 1 is not throwaway work. The final provider-backed design still needs a **rough per-part estimator**, and `tokenx` can fill that role. So replacing `tiktoken` first gives a fast performance win and becomes a direct building block for phase 2.

## Phase 2 details: provider-backed grouped counting

### Core idea
Once phase 1 is in place, add a second strategy for higher-fidelity counting.

Provider mode should work like this:

1. **Rough count each part**
   - Use `tokenx` to estimate each part cheaply.
   - Store the rough estimate on a new cached metadata key next to the measured token-estimate metadata.
   - Continue using these rough part-level counts for incremental chunk growth.

2. **Form grouped measurement checkpoints**
   - As OM accumulates parts, keep summing rough counts.
   - Once a group reaches a meaningful checkpoint, issue **one provider measurement request for the whole group**, not one per part.

3. **Use fake-fetch preflight to capture provider-native request formatting**
   - Build a provider request using `createOpenAI`, `createAnthropic`, `createGoogleGenerativeAI`, etc.
   - Inject a fake `fetch` implementation.
   - Ask the provider SDK to format a normal generation request containing only the parts/messages being measured.
   - Intercept the outgoing request in fake fetch, capture the provider-formatted body, and abort immediately before any real generation request is sent.
   - Convert the captured provider payload into the corresponding provider token-count request.

4. **Measure the grouped parts once**
   - Call the provider token counting endpoint using the captured provider-native payload.
   - Read the provider total for the full grouped measurement.

5. **Redistribute the provider total back onto the parts**
   - Use the rough per-part estimates as weights.
   - Compute each part's share of the provider total according to its rough-estimate ratio.
   - Cache the redistributed measured count back onto each part using the existing token-estimate cache location, extended with source metadata as needed.

6. **Fallback behavior**
   - If provider measurement fails for any reason (unsupported provider/model, timeout, 429, malformed response, missing token-count endpoint), immediately fall back to the local heuristic path.
   - `auto` mode should prefer provider counting when healthy and automatically use the local heuristic path when provider counting is unhealthy.

## Redistribution rules for phase 2

### Primary rule
Redistribute provider totals strictly using rough token ratios.

Example:

- rough counts: `[100, 200, 300]`
- rough total: `600`
- provider total: `1200`

Then final cached measured counts become:

- part 1: `1200 * 100 / 600 = 200`
- part 2: `1200 * 200 / 600 = 400`
- part 3: `1200 * 300 / 600 = 600`

### Integer allocation rule
Use deterministic integer redistribution so the part totals sum exactly to the provider total:

1. compute fractional allocations,
2. floor each allocation,
3. distribute the remainder to parts with the largest fractional leftovers.

### Zero rough estimates
A zero rough-sum should be treated as an estimator failure path, not a normal redistribution case.

That means:

- do **not** split equally by part count,
- do **not** fall back to character length weighting,
- instead, fall back to the local direct-counting path for that grouped measurement.

## Concurrency and rate limiting for phase 2

### Do not measure per part
Provider measurement should **not** send one request per part.

Instead:

- local rough estimation remains per part,
- provider measurement happens per grouped checkpoint.

### Concurrency control
Add a small in-process limiter for provider counting, scoped by provider/model.

Also add in-flight deduplication keyed by group hash so identical grouped measurements share the same promise.

### Rate limit behavior
If provider counting returns rate-limit or transient failures:

- fall back to the local heuristic path,
- optionally apply a short cooldown for that provider/model,
- let `auto` mode skip provider counting during cooldown.

## Configuration direction
After phase 2, add a token measurement strategy option such as:

```ts
tokenMeasurement?: 'tokenx' | 'provider' | 'auto'
```

Semantics:

- `tokenx`: preserve local cheap counting behavior,
- `provider`: use rough-per-part `tokenx` + grouped provider counts + fallback to local counting,
- `auto`: prefer provider counting when supported and healthy, otherwise use local counting.

If keeping `tiktoken` as a backward-compatible explicit mode turns out to be necessary, that can be added separately. But the current phased direction is to replace `tiktoken` first, then build provider mode on top of the cheaper estimator.

## Cache direction

### Part-level cache
Keep part-level cached token data so OM can continue summing part estimates.

After phase 2:

- one cache key stores rough local estimates,
- one cache key stores measured/distributed totals with source metadata.

### Group-level cache
Add a grouped-measurement cache keyed by:

- provider,
- model,
- measurement mode/version,
- normalized group content hash.

Store:

- exact provider total,
- provider/model identity,
- measurement source/version,
- maybe timestamp for troubleshooting.

## Final phased implementation direction

### Phase 1
1. Add `tokenx` dependency.
2. Replace `js-tiktoken` text counting in `token-counter.ts`.
3. Remove the global encoder singleton and encoding-id cache logic.
4. Keep image/file heuristics intact.
5. Update tests and docs to reflect local heuristic counting.
6. Remove `js-tiktoken` dependency if no longer needed.

### Phase 2
1. Add grouped provider measurement with fake-fetch request capture.
2. Add rough-estimate metadata next to measured token metadata.
3. Add provider adapters for OpenAI, Anthropic, and Google where supported.
4. Redistribute provider totals back to parts using rough ratios.
5. Add concurrency limiting, in-flight dedupe, and optional cooldown.
6. Add/update config for provider mode and auto mode.
7. Update OM tests, docs, and changesets.
