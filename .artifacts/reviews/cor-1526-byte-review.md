# COR-1526 independent review — REQUEST CHANGES

Candidate: `bed5d0b1fdbd5966929356abee9dd3e1979d8cfb`
Base: `cf919d1f2a53bb7f2e72d219d94243c584e9d0dd`
Repository: mastra-ai/mastra; detached review checkout: `/workspace/.worktrees/cor-1526-review`.

## Findings

### P2 — The retained-byte limit has unbounded empty-queue and terminal exceptions

Locations: `packages/core/src/agent/streams/publisher.ts:292-294` and `:413-417`; terminal payload contents at `packages/core/src/agent/streams/wire.ts:105-119`.

`overLimit` enforces the byte ceiling only when `pendingBytes > 0`. A first queued frame (or first after the queue drains) can therefore retain an arbitrarily large text/tool/workflow payload behind a hung publish/cache write. Independently, `finish` calls `enqueueFrame` directly without checking the ceiling. Its payload includes the complete text, structured object, messages, and step data, not a fixed-size control record. A long run can thus retain an arbitrarily large final snapshot even after normal frames were dropped. A bounded number of control tasks is not a byte bound on their captures.

Reproduction: reviewer probes enqueue a 9 MiB text frame into an empty held publisher and separately a finish containing 9 MiB text. Both are accepted and neither reports replay incompleteness; the corresponding budget assertions fail. Apply the limit at zero pending bytes too, and keep terminal/control publication bounded without reporting a silently truncated successful replay. Direct caller delivery must remain unchanged.

### P2 — Size estimation can undercount or assign zero to arbitrarily large retained outputs

Location: `packages/core/src/agent/streams/publisher.ts:244-249`.

`JSON.stringify(value).length` counts UTF-16 code units, not bytes. A 3 Mi-character CJK text frame has over 9 MiB of UTF-8 text alone but is admitted under the 8 MiB constant. More seriously, stringify failures return zero: a tool output with a BigInt or cycle and a 9 MiB string is queued without any byte charge. Up to the count cap of these arbitrary-size graphs can remain captured during an outage. A zero charge is not conservative accounting for an unsizeable payload.

Reproduction: isolated publisher probes for UTF8, BigInt, and cyclic outputs all fail the assertion that an over-budget frame is refused/reported. Account for actual/conservative bytes, and handle unsizeable values without allowing them to bypass the limit; preserve direct output and explicit observer incompleteness.

## Verification

Candidate dependencies installed with frozen lockfile. Workspace dependencies built (13/13 Turbo tasks), then core explicitly rebuilt before external-adapter probes. Core production `tsc --noEmit` passed.

Existing suites all passed:

- `src/agent/streams/__tests__`: 10 files, 87 tests.
- Previously run targeted idle/processor/signal suites: 6 files, 95 tests.
- Seven resume/version/concurrency files: 33 tests.
- `src/loop/shared/stream-until-idle-helpers.test.ts`: 8 tests.
- Server `src/server/handlers/agent.test.ts` and `workflow-stream-cache.test.ts`: 40 tests.

New disposable probes:

- Core public-API byte overflow: all 12 MiB direct text preserved; attached and fresh observers receive `AGENT_STREAM_REPLAY_INCOMPLETE`.
- Core marker fault: both marker attempts reject; no false successful finish.
- Redis 7, real `RedisStreamsPubSub` plus `RedisServerCache`, public `Agent.stream`, `generate`, `observe`: 5 tests passed. Generated stream/generate finish during docker-paused Redis; supplied ID refuses after roughly five seconds; count and byte overflow preserve direct output and produce incomplete replay after recovery. Unicode end-to-end overflow also passes; aggregate step/message data crosses the existing character budget, so this is NOT the isolated proof of incorrect Unicode sizing.
- Five deterministic byte-contract probes FAIL on the candidate: oversized first frame, UTF8 size, BigInt, cycle, oversized finish. These are the supported finding reproductions, not unexplained suite failures.

Reproduction files (untracked, review worktree only):

- `packages/core/src/agent/streams/__tests__/review-faults.test.ts`
- `pubsub/redis-streams/src/cor1526-review.test.ts`

Commands:

```
# From review worktree root:
pnpm exec vitest run --project unit:packages/core src/agent/streams/__tests__/review-faults.test.ts
# From pubsub/redis-streams, with isolated Redis at localhost:16379
# and container name cor1526-review-redis for pause/unpause:
pnpm exec vitest run src/cor1526-review.test.ts
```

Logs: `/workspace/.worktrees/cor-{faults-final,redis-final,server,idle,resume}.log`.

## Other conclusions and limits

No supported new blocker found in supplied-ID provenance, local reservations, bounded fail-closed explicit/resume admission, or setup ordering. The first-drop marker/control path adds constant queue work rather than one promise per rejected frame. Gap-before-success and failure-to-report suppression worked in targeted tests. Durable/evented implementation was not edited by this delta; full engine parity was not rerun.

The author's exact 119-test adjacent selection was not supplied; the concrete selections above are independently reported, not asserted equivalent. No new real HTTP-socket fault test, cross-process atomic-claim proof, lint rerun, or full-load benchmark was performed. HTTP handler regressions passed; attached/fresh overflow behavior was exercised through core observers. Nonserializable probes isolate publisher retention, not a full Redis tool-output execution.

No production source edits, pushes, remote comments, PR changes, or merges. Original checkout remains clean. Only two untracked disposable test files exist in the detached review worktree.

## Proof-only handoff

The standalone exact five failing assertions are in `packages/core/src/agent/streams/__tests__/review-byte-contract.test.ts`. Run only that file with `pnpm exec vitest run --project unit:packages/core src/agent/streams/__tests__/review-byte-contract.test.ts`. These probes encode the review contract, not a mandatory implementation shape. The proof branch contains no runtime changes.
