# PR3 streaming evidence and design gate

Date: 2026-11-09. **Evidence/design only. No production changes; no implementation approval.**

## Decision

**KEEP BOTH:** plain direct caller output plus asynchronous replay publication; durable/evented continue published-stream readback. The evidence supports small, separately approved contract fixes, not delivery-path convergence.

Three distinct findings survive merged PR1. Do not combine them into one transport defect:

1. Plain caller frames lack topic-log `index`; observed/replayed frames have it.
2. Plain direct finish contains fields its published finish drops.
3. In-process retained step payloads can change after publication; serialization controls do **not** reproduce that drift.

## Revisions and runtime provenance

- Initial source: `a2a03b53fe71a4587ee12cd121f2f43d9ede445d`.
- PR1 merged source: `ed1cecba5c26a73600640f74e9a1c9d322271b23`, subject `refactor(core): share durable and Inngest run lifecycle setup (#29635)`.
- Artifact branch: `proof/pr3-stream-payload-evidence`, independent of PR1/PR2; no merging their branches.
- Merged rerun: detached worktree `.artifacts/pr3/merged-runtime`, exact merged commit, **unchanged** config and three test files. Dependencies linked from prepared checkout; touched first-party modules resolved from merged source, not original source/dist.
- Fresh provenance: 985 unique package modules initial, 987 merged; each loaded 11 vendored AI SDK dist modules and **zero non-vendored dist modules**. Merged run loaded zero non-vendored package modules outside its source root. Vendored source is unchanged between these revisions.
- Node `v22.23.3`; source aliases explicitly cover core, internal core/auth/voice, schema-compat and workflow test utils. Real Memory, InMemoryStore, CachingPubSub and transport; AIMock only at model HTTP boundary.
- Full COR-1510 text unavailable (lookup returned not found). Scope is the supplied brief; `resume numbers` is tested as topic-log `index`, not an invented `resumeNumber` field.

## Reproductions and observations

All assertions below passed on **both** exact revisions: **3 files / 18 tests**, initial 20.82s, merged 20.72s. These are evidence assertions of current behavior, not evidence of fixes.

### 1. Resume cursor absence — caller vs published stream

Plain text and approval caller frames have no `index`; durable/evented caller frames have numeric indexes. Live and replay public indexes match, including gaps for retained lifecycle records not exposed as chunks. Approval reconnect with `offset = suspended.index + 1` receives resumed text, no old approval chunk, one finish; tool executes once.

Symptom: a consumer that starts with plain direct frames cannot derive a replay cursor from those frames. This does **not** mean publication/replay lacks indexes. An observer-based caller can retain its last `index` and reconnect from `index + 1`.

Mechanism: `packages/core/src/loop/workflows/stream.ts:60-63` enqueues the direct chunk before publishing asynchronously; `packages/core/src/events/caching-pubsub.ts:182` allocates the retained index at append. Adapter attaches the authoritative event index at `packages/core/src/agent/durable/stream-adapter.ts:680-688`.

### 2. Finish envelope loss — direct vs published, not live vs replay

In plain text/resumed direct output the finish payload has `messageId`, `metadata`, `processorRetryCount`, `response`; published live/replay finish omits those keys and carries `output`, `stepResult`, optional `messages`. Durable/evented callers consume the published shape, so their caller/live/replay finish envelope agrees in these captures. That is transport-path agreement, not proof that every engine's result schema is identical.

Mechanism: plain publisher explicitly projects to those three keys at `packages/core/src/agent/streams/publisher.ts:212-215` (merged: 210-213); adapter reconstructs the same narrow payload at `packages/core/src/agent/durable/stream-adapter.ts:732-763`.

Step-finish engine differences also exist: plain includes rich output/metadata; durable/evented include `_durableStepContent`, `_durableResponseMessages` and a different output shape. Existing COR-1390 parity declarations already acknowledge engine differences; those differences alone are not new regressions proven by this investigation.

### 3. Mutable in-process retained step payload

For normal approval, live step-finish output step counts are `[1,2]`, but replay of the same indexed frames reports `[2,2]`. The first retained payload acquired later steps. This is historical payload instability, not a duplicate streamed token or an extra tool execution.

Controls:

- JSON snapshot at cache append alone: live/replay both `[1,2]`.
- JSON serialization at cache append **and transport publish**, normal/durable/evented: all text/index/offset/finish assertions pass; normal live/replay both `[1,2]`.
- Durable/evented ordinary controls have no analogous live/replay lifecycle payload divergence in these fixtures.

Mechanism: `packages/core/src/loop/loop-builder.ts:598,619` appends accumulated steps and includes that same array in payload; `packages/core/src/cache/inmemory.ts:138` shallow-copies the event, retaining nested references; EventEmitter transport also shallow-copies. Later resume mutation is therefore observable in in-process retained history. No production source mutation was needed for this causal control.

**Bounded conclusion:** proven with in-process cache/bus, eliminated by tested JSON snapshots. This is **not** proof that Redis/serialized remote persistence mutates history. JSON controls are not a real Redis transport implementation and do not validate Redis codec, redelivery or atomicity.

### Lifecycle, processors and callbacks

Raw ordered topic logs retain `suspended` and durable/evented `iteration-complete` records, not merely visible text. Captured replay has one finish, matched public index sequences and one tool execution. No whole-until-idle aggregate replay promise is assumed.

The approval harness deliberately stops initial collection at the approval frame. **It does not prove a caller-stream termination defect.** Initial-vs-resumed frames are intentionally recorded separately.

An output redactor replaces each text delta with `[REDACTED]`: caller/replay text agree across all engines. Original caller step and finish callbacks each run once; observer-specific finish callback runs once. Plain replay invokes no output processor in this fixture; wrapped replay invokes `start`, `step-finish`, `finish` processors again, but not delta processors. These concrete semantics must be preserved/explicitly specified before any convergence. Do not infer arbitrary processors are globally exactly-once, or callbacks have identical reconstructed data.

## Failure and backpressure controls

Bounded gate: block retained append, inspect at 350ms, then release and drain.

| Control | Plain direct caller | Durable/evented caller | Replay/publication |
|---|---|---|---|
| Block cache append | Finishes while gate remains closed | Not finished until release | Delayed; all complete after release |
| Throw cache append (plain only) | Finishes with expected text | Not tested | Empty retained history; cache logs errors; live transport attempted |
| Throw stream transport publish (plain only) | Finishes with expected text | Not tested | Cache history retained, live fanout unavailable |

These demonstrate distinct response vs replay failure domains. They are not an unbounded backlog, sustained throughput, durable outage or memory-pressure qualification. The publisher queues append/publish work; asynchronous isolation does not imply finite queue growth under an indefinitely slow backend.

Existing 48-trial bounded-RTT artifact commit `d9a63a270a1771f0cb8081278c2e7b2454404ec0` was unavailable here (initial fetch timed out); not rerun or relied upon. Its known 0/20ms local TCP RTT emulation is not remote Redis evidence.

## Options requiring approval

### A — Recommended minimum: keep paths; repair explicit contracts separately

1. Decide whether retained payloads are immutable snapshots. If approved, snapshot at the publication/retention boundary before subsequent mutations (including nested arrays). Prefer a well-defined codec/DTO over arbitrary JSON cloning in production. Cost: serialization/clone CPU, allocation and possible type-fidelity changes; define errors/non-serializable values first. Cache-only JSON control proves this fixture, not every asynchronous queue race.
2. Define the public finish DTO; preserve agreed serializable fields when publishing and reconstructing it. Do not blindly spread private/internal/raw request objects. Cost: payload/storage/network growth, compatibility, privacy and callback/processor semantics. Keep rich-result engine parity as a separately scoped contract decision rather than silently implementing COR-1390 here.
3. Decide whether plain direct streams promise replay cursors. Lowest-change supported route now is explicit observe consumption for indexed delivery. If direct indexing is required while keeping async publication, design sequence reservation/append agreement, suspended/resumed continuity, shared writers, and append-failure gaps. Do **not** stamp an unrelated local counter and call it the topic index.

### B — Opt-in published readback for plain callers

Indexed caller/replay shape alignment, but adds cache/transport latency and availability dependence. Must explicitly specify callbacks, lifecycle processor re-entry, disconnect/cleanup and queue bounds. This is a potential future opt-in, not the default recommendation or an implementation approval.

### C — Converge all callers on publish/readback

Not recommended from this evidence: it removes demonstrated plain caller failure isolation and introduces backend latency/backpressure into user responses. No real remote Redis result here justifies it. It also does not itself fix shared-reference retention or settle finish DTO semantics.

## Artifacts and exact commands

- `payload.test.ts`: 10 public-API payload cases; ordered caller-initial/caller-resumed/live/replay/offset/topic frames and summaries.
- `controls.test.ts`: 5 failure/backpressure controls.
- `semantics.test.ts`: 3 processor/callback controls.
- `vitest.config.ts`: source aliases, isolated cache and module provenance.
- `results/`: initial raw JSONL, summaries, fresh verification and module logs.
- `results-merged-pr1/`: corresponding merged-PR1 outputs.
- `manifest.json`: revisions, test/config hashes, runtime/dependency provenance.
- `analyze.mjs`: compact summary extraction from both archived result directories.

Run in `/workspace/mastra` at the initial revision, prepared dependencies:

```sh
pnpm exec vitest run --config .artifacts/pr3/vitest.config.ts
```

Merged verification used:

```sh
git fetch origin ed1cecba5c26a73600640f74e9a1c9d322271b23
git worktree add --detach .artifacts/pr3/merged-runtime ed1cecba5c26a73600640f74e9a1c9d322271b23
# Copy the unchanged four .ts harness files into that worktree's .artifacts/pr3.
# Link prepared root/package node_modules and unchanged vendored SDK dist dirs.
cd .artifacts/pr3/merged-runtime
pnpm exec vitest run --config .artifacts/pr3/vitest.config.ts
```

No package metadata/dependencies/peer ranges/checkers changed. No broad unrelated suites run. These artifact tests were executed by Vitest, not separately TypeScript-typechecked. Source diffs are empty in both worktrees.

## Limits and explicit gate

Unverified: real remote Redis; sustained overload/unbounded queue growth; durable/evented outage behavior; arbitrary callback/processor side effects; server/SSE/client SDK adapters; Inngest, fs engine; whole-until-idle aggregates; expiry/cancellation/ownership races (PR4's scope). Serialization controls exercise JSON copy boundaries, not a production remote codec. Pin PR1 exactly as above; do not label results as all future main revisions.

**STOP before implementation.** Approval must select the snapshot contract/boundary, finish DTO/field allowlist, and whether indexed plain direct delivery is required. Default remains KEEP BOTH. No production fix, convergence, dependency change, PR, GitHub/Linear/Slack comment, or merge is authorized by this report.
