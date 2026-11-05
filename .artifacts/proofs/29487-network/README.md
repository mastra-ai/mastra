# Issue 29487: public network baseline proof

Evidence-only handoff; extract/adapt these files, **do not merge this branch's history**. Parent is baseline `ccde1973bcce4305f93c58c60d9df4d96639acfc`. No production code, logs, captured evidence payloads, or secrets are included.

## Run

From the repository root with workspace dependencies/build prerequisites installed:

```sh
./node_modules/.bin/vitest run --config .artifacts/proofs/29487-network/vitest.config.ts
```

Optional raw runtime logging is disabled by default. To retain local evidence, set `NETWORK_PROOF_LOG` to a writable file outside the repository, for example `/tmp/29487-network-proof.jsonl`.

## Proven baseline behavior

The original scratch fixture passed 20/20 independent executions (60/60 cases). **Passing means the collision was reproduced, not that isolation works.** Real AIMock HTTP, Agent.network(), registered Mastra shared EventEmitterPubSub/cache, and Memory/InMemoryStore are used. RecordingBus delegates to real pubsub; it does not manufacture events.

Network dispatch is sequential A then B using the enclosing runId, not concurrent same-ID workflow execution. At B's blocked tool boundary, A's agent-owned record is finished and B's is running. The cases show:

- `output-replay`: B.observe receives A_MARKER, terminates before B completes, and a fresh B observer replays A_MARKER.
- `abort`: after A finishes, A's observer.abort() aborts B's active tool.
- `cleanup`: A's accelerated 1000ms publisher cleanup erases the shared run-only replay list while B is running (original evidence: 13 entries to 0, including B tool frames).

The facade is drained separately and reaches B_MARKER in non-abort cases. No claim is made that the facade itself prematurely terminates. Memory recall verifies messages were persisted.

## Adaptation for implementation session

These are baseline **bug-presence** assertions, intentionally not positive regression assertions. Do not copy them unchanged into the production suite.

1. Keep the real two-subagent public network dispatch, registered shared bus/cache, tool barrier, distinct ownership records, facade drain, and memory assertions. Reuse the existing AIMock scenario harness rather than synthetic transport publishers.
2. For positive live/replay proof, start consuming B's live observation before network dispatch, let B finish, then assert B_MARKER and no A_MARKER. On the fixed head a B observer must stay open while B's tool is blocked: do not await its drained chunks at the original pre-release point, or the test deadlocks. Collect the late replay once B has completed.
3. Abort isolation: invoke A's observer.abort() while B is blocked, prove the control request traversed the real bus, then release B and assert its tool signal never aborted and B_MARKER reaches the facade. Do not merely invert the current waitFor assertion: a vacuous immediate negative check misses asynchronous delivery.
4. Cleanup isolation: the fixture's literal `pubsub:agent.stream.${runId}` cache key and clear-topic assertion are intentionally baseline-specific. On the new boundary, inspect the actual scoped B topic/cache list (derive from real recorded publications or the implementation's topic helper). Wait for A's actual cleanup, assert B's preexisting frames remain and B stays running, then finish B and verify its public replay. A's 1000ms cleanup deadline is configured, not fake time.
5. Run positive assertions against the fixed head, then temporarily restore baseline transport binding or apply a scoped-topic mutation to prove intended assertions fail. Do not treat fixed-head failures of this bug-presence fixture as positive isolation proof. This handoff itself covers only the normal engine.

Portability changes from the proven scratch fixture: relative imports adjusted for this directory; Vitest include relocated; JSONL logging made opt-in. Config assumes invocation from repository root and loads `packages/_test-utils/src/setup.ts`. Workspace packages (including memory dependencies) need their normal builds/links. Vitest transpiles this scratch fixture; it is not an independently typechecked production suite.
