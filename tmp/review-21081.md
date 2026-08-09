Verdict: request changes

## Findings

**Correctness — blocking: `Run.watch` acknowledges before the watcher's work completes (`packages/core/src/workflows/workflow.ts:4042-4082`).**

`wrappedCb` calls `cb(event.data as WorkflowStreamEvent)` without awaiting, then `await ack?.()`. The `watch` signature declares `cb: (event) => void`, but every internal caller passes an async function — `streamLegacy` (3661), `observeStreamLegacy` (3731), `stream` (3824), `resumeStream` (3954), `timeTravelStream` (4756). The delivery is therefore acked while the consumer's work is still in flight, and a rejection is both unobserved (floating promise) and unredeliverable. `nestedWatchCb` has the same shape: it acks after issuing `void this.pubsub.publish(...)`, so a failed re-publish of a nested event is acked as success and the event is lost.

This is the one place in the PR that diverges from the contract the PR itself establishes — the thread subscriber, the remote-run waiter, the abort listener, and the user topic listeners all settle the delivery on the handler's actual outcome. Given that this PR's whole premise is correct ack semantics on durable backends, a subscriber that acks optimistically converts a transient watcher failure into permanent event loss, and the fix is mechanical (await the handler; ack on success, nack on throw).

**Correctness — rest of the change: sound.** The `EventCallback` widening to `void | Promise<void>` is the right contract change, and the ack sites that were audited settle every delivery exactly once:
- `thread-stream-runtime.ts:1465` acks in a `try/catch` before checking terminality, so a backend ack failure cannot strand the waiter, and the terminal ack completes before `finish()` — the unsubscribe genuinely cannot race it.
- `thread-stream-runtime.ts:1747` keeps `eventTail` ordering intact while returning the per-delivery outcome, so ordering and redelivery are independent. Correct, and the comment explains why.
- `caching-pubsub.ts` acks pre-offset drops and dedup-suppressed duplicates (deliveries the consumer never sees are the exact ones that would otherwise sit pending forever), and routes a rejected buffered delivery to `nack` now that the backend is no longer observing the return value. The bootstrapping branch correctly defers settlement to the drain rather than acking twice.
- `mastra/index.ts` memoizes the wrapper per listener in a `WeakMap`, which is what keeps `removeTopicListener` and the `#userEventSubscriptions` dedup working on identity. Without that memoization this change would have silently broken listener removal.

**Test assessment:** adequate for the core paths. `agent-thread-stream-ack.test.ts` asserts ack counts on filtered-out events and on the cross-agent waiter; the Redis suites assert `XINFO GROUPS` pending reaches zero against a real backend, which is the only way to actually prove the reported symptom is gone. The gap is the blocking finding above: there is no test covering a watcher callback that rejects, which is why the premature ack in `workflow.ts` went unnoticed.

**Scope:** coherent. Every file serves the single goal, and the in-process transport commit is a necessary consequence of widening the callback return type rather than unrelated work.

**Pattern consistency:** the ack-in-`finally`-style discipline and the comments explaining *why* each site acks match how this area has been maintained (see #19138, #18479, #17723 — all of which had to reason about redelivery semantics explicitly). `workflow.ts` is the outlier.

## Verification

Ran in the session sandbox on the PR head (`0f63c8f2`), with GitHub credentials stripped from every command:
- `pnpm turbo build --filter @internal/test-utils` — pass (needed; the checkout's deps were unbuilt)
- `pnpm turbo build --filter @mastra/core` — pass
- `npx vitest run src/agent/__tests__/agent-thread-stream-ack.test.ts src/events/caching-pubsub.test.ts src/events/event-emitter` — **123 passed / 6 files**, no type errors
- `npx vitest run src/workflows/workflow.test.ts` — **305 passed, 4 skipped**, no type errors
- `pnpm --filter @mastra/core exec tsc --noEmit` — fails, but entirely on pre-existing unresolved workspace imports unrelated to this diff (e.g. `@mastra/schema-compat/zod-to-json`, `LocalSandbox.logger`); vitest's typecheck over the changed files reported no errors.
- Static inspection of the diff before execution: no changes to `package.json` scripts, lockfiles, test setup/config, or CI workflows — safe to run.
- Redis suites (`pubsub/redis-streams`) were not executed here (no Redis instance in the sandbox); they were reviewed statically.
- CI: many jobs still pending; `mergeStateStatus` is `BLOCKED` with `mergeable: MERGEABLE`, so no conflict rework is implied. Noted, not counted as a finding.

## Existing review disposition

CodeRabbit (`coderabbitai`, the only reviewer) — note its check reports **"Review rate limited"** for the final commit, so `caching-pubsub.ts` and `event-emitter/index.ts` never received an inline pass. That signal is incomplete; those two files were reviewed here manually instead.

- **🟠 Major — `workflow.ts:4047`, "Acknowledge only after the watcher work completes": CONFIRMED.** Reproduced against the source; this is the blocking finding above.
- **🟠 Major — `agent-thread-ack.test.ts:195`, waiter subscription/publish race: REFUTED.** The claim is that a `run-completed` published before the waiter's consumer group exists would be missed because the group reads from the tail. `RedisStreamsPubSub` creates every group with `xGroupCreate(streamKey, group, '0', { MKSTREAM: true })` (`pubsub/redis-streams/src/index.ts:305`, and the same at 638/642 on reconnect) — from the head of the stream, not `$`. A group created after the publish still reads the earlier entries, so the waiter observes the terminal event regardless of ordering. The seeder teardown half of the comment is likewise moot: the seeder's group is deleted on unsubscribe, so its entries cannot contribute to the pending count.
- **🟡 Minor — changeset omits several fixed subscribers: CONFIRMED, non-blocking.** Addressed in the follow-up PR below.
- **🟡 Minor — misleading `topic: event.type` log field (`mastra/index.ts:5832`): CONFIRMED, non-blocking.** The wrapper is memoized per listener and shared across topics, so it genuinely cannot know the topic. Addressed in the follow-up PR below.
- **🔵 Trivial — `pubsub-ack-audit.test.ts:17` deep relative imports into `packages/core/src`: REFUTED as a defect.** The symbols under test (`subscribeToAbortRequests`, `AGENT_CONTROL_TOPIC`, `AgentThreadStreamRuntime`) are internal and not exported from `@mastra/core`'s public entrypoints, so a deep import is the only way to exercise them. Deliberate.

## Requested changes

1. **`packages/core/src/workflows/workflow.ts` — settle both watch callbacks on the handler's real outcome.** `await` the `cb(...)` call in `wrappedCb` and `await` the `pubsub.publish(...)` calls in `nestedWatchCb`, then `ack` on success and `nack` on throw, matching the other subscribers in this PR. Widen the `watch` parameter type to `(event: WorkflowStreamEvent) => void | Promise<void>` so the async callers every internal caller already passes are honestly typed.
2. **Add a regression test for a rejecting watcher delivery** — assert it nacks rather than acks. This is the coverage gap that let finding 1 through.

## Follow-up PR

The two non-blocking mechanical fixes are implemented in #21085, which targets `fix/thread-stream-pubsub-ack` so they can be merged into this PR directly: the log field rename (`topic` → `eventType`) and the changeset entry expanded to name every subscriber this change fixes.

## Assumptions

- Treated the deep relative imports in the Redis test suites as deliberate rather than a layering violation, since the symbols under test are internal-only.
- Treated the pre-existing `tsc --noEmit` failures in `@mastra/core` as environmental (unbuilt sibling packages) rather than PR-introduced, based on the errors landing exclusively in files this diff does not touch.
- Treated `EventCallback`'s doc line "The promise is not awaited before the next delivery" as describing the general transport contract, not `CachingPubSub`'s bootstrap path (which does await, to preserve history ordering). Not flagged.
- Treated the still-pending CI jobs as ordinary queue latency rather than signal about this change.

## Open questions

- CodeRabbit was rate-limited on the final commit, so `caching-pubsub.ts` and `event-emitter/index.ts` carry only this manual review. A maintainer may want to re-trigger the bot after the requested changes land.
