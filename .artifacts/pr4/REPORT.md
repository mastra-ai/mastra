# PR4 lifecycle contract investigation — evidence and proposal

Date: 2026-11-09. **Design/investigation only; human approval required before implementation.**

## Verdict

COR-1512 is reproduced before and after PR1. During retained finished replay, DurableAgent/evented authorize the executor's authenticated owner but return 404 through another HTTP process, although both processes can read the same finished replay. This is an ownership-lifetime/distribution defect, not evidence that Redis lost output. Plain Agent with `durable:true` already authorizes shared replay correctly.

Three separate contract gaps must not be confused with COR-1512: observing the returned until-idle run ID is segment-scoped, an acknowledged parked-run abort need not prevent cross-process approval side effects, and loss of all history currently permits an empty open observation rather than an explicit replay-gap result.

## Provenance and reproducibility

- Initial unchanged source: `a2a03b53fe71a4587ee12cd121f2f43d9ede445d`, branch `investigation/pr4-lifecycle-contract`.
- Revalidation source, after merged PR #29635: `ed1cecba5c26a73600640f74e9a1c9d322271b23`, branch `investigation/pr4-lifecycle-contract-post-pr1`.
- Fresh forced build on merged source: **31/31 tasks successful, 0 cached**, `.artifacts/pr4/build-post-pr1.log`. No production files changed; no PR, issue comment, or runtime fix created.
- Two genuine independent Node child processes, each serving public Hono HTTP routes. Shared **local Docker Redis** at `127.0.0.1:16379` supplies real RedisStreamsPubSub, RedisServerCache and RedisStore. Real Agent/createDurableAgent/createEventedAgent, memory, deferred background tools, approval tools, and execution barriers. AIMock replaces only model HTTP. This is **local integration evidence, not production evidence**.
- COR-1512 Linear lookup was unavailable; scope comes from the supplied user brief, not verified ticket text.
- Compact results: `.artifacts/pr4/evidence-summary.json`. Authoritative post-PR1 per-invocation logs: `matrix-post-pr1.log`, `post-pr1-approval-{baseline,remote-abort,local-fence,local-abort}.log`, `post-pr1-continuation-{durable,plain,evented}.log`, `post-pr1-eviction-independent.log`, `post-pr1-run-access-tests.log`.
- Initial individual logs are listed in `provenance-initial.json`. Aggregate `reproduction.jsonl`, `lifecycle.jsonl`, and `eviction-independent.jsonl` append across invocations/baselines: **do not label an entire aggregate as initial-source evidence**. Use individual invocation logs and the merged-source summary.

Re-run from repository root, with dependencies installed and Redis running:

```sh
git rev-parse HEAD  # require one of the exact commits above
pnpm exec turbo build --filter=@mastra/server... --filter=@mastra/hono... --filter=@mastra/libsql... --filter=@mastra/redis-streams... --filter=@mastra/memory... --force
node .artifacts/pr4/reproduce.mjs durable plain evented
for v in baseline remote-abort local-fence local-abort; do
  node .artifacts/pr4/lifecycle.mjs durable approval "$v"
done
for kind in durable plain evented; do
  node .artifacts/pr4/lifecycle.mjs "$kind" continuation
done
node .artifacts/pr4/eviction-independent.mjs
(cd server-adapters/hono && pnpm exec vitest run src/__tests__/run-access-http.test.ts)
```

Harnesses are investigation artifacts, not checked-in product regression tests. The Redis container must be started separately, e.g. `docker start pr4-investigation-redis`; if absent create a Redis container bound to local port 16379. Node child processes are killed by harness finalizers. Do not run identical-ID fixtures concurrently; generated run IDs are unique.

## 1. COR-1512 — retained finished replay

Post-PR1 durable run `pr4-durable-1794203335108`:

| Caller | Executor HTTP | Other HTTP process |
|---|---:|---:|
| authenticated owner Alice | 200, finished replay | **404** |
| other resource Bob | 403 | 404 |
| anonymous | 401 | 401 |
| Alice after 31.5 seconds | 404 | 404 |

Both processes read **9 cached events ending in finish**; only executor reports local owner `{resourceId:"alice"}`. Public abort on the finished run returns `200 {"aborted":false}`. Evented has the same replay/access pattern. Plain Agent(`durable:true`) returns finished replay 200 through both processes, denies Bob with 403 on both, and anonymous with 401; both expire to 404 after cleanup.

Mechanism: `packages/server/src/server/handlers/agents.ts:2520` authorizes durable snapshots; `:2593` selects the process-local `__getRunOwner` for MEMORY_READ then falls back to snapshots. Durable owner getter is `packages/core/src/agent/durable/durable-agent.ts:980`; local registry is `packages/core/src/agent/durable/run-registry.ts`. Finished snapshot cleanup leaves local replay ownership but no shared authorization proof for the peer. This does not justify authorizing by knowledge of run ID, thread guesses, transport presence, or cached output contents.

Important diagnostic correction: raw Redis transport `getHistory()` was empty while the **caching PubSub layer** had retained frames. Earlier raw-history observations did not establish replay loss. Cache list length and wrapped history establish retained output.

## 2. Until-idle / multipart continuation

Used supported `agent.stream(..., {untilIdle:{maxIdleMs:1200}, memory:...})`, a real deferred background tool, and an IPC release barrier. Each of plain/durable/evented produced background-task-started, initial finish, background-task-completed, then a new segment with a distinct run ID and final text `amount 42 continuation`; one actual tool commit and three model HTTP calls. These are sequential supported segment IDs, not fabricated concurrent runs.

Example durable returned public ID: `0c20f588-3837-49b6-ae9f-084efc04b5f5`; actual continuation ID: `8f5615eb-f06f-49cd-b259-66148c317957`.

Observing **the public returned first ID** closes at its initial finish and never delivers continuation text. Before barrier release, plain local/remote and wrapped executor observe return 200 first-segment replay; wrapped peer returns 404 (COR-1512). After outer stream drains, wrapped first-ID observe is 404 even locally because outer cleanup released segments; plain retains first-segment replay, still without continuation. See `packages/core/src/agent/durable/durable-stream-until-idle.ts:6`, `:62`, `:86` and HTTP finish handling `packages/server/src/server/handlers/agents.ts:3170`.

**Minimum recommendation:** explicitly specify observe(runId) as **one execution segment**, not the entire until-idle session. A whole-session reconnect promise needs a separately approved stable session identity, authenticated segment linkage and session cursor/terminal semantics; merely retaining initial ownership cannot provide it.

## 3. Threadless approval-parked cancellation

DurableAgent, shared real Redis workflow snapshot, same returned run ID, approved on the *other* process after each action. Parked observations on both servers return HTTP 200 plus approval frames and remain open within a 1.5-second measurement; the earlier full-body timeouts were not access failures.

| Action before remote approval | Response | Remote approval | Actual tool commits |
|---|---|---|---:|
| none | — | 200 | 1 |
| local direct abortRunStream | true | 200 | **1** |
| executor HTTP abort | 200 `{aborted:true}` | 200 | **1** |
| other-process HTTP abort | 200 `{aborted:true}` | 500 cannot resume aborted run | 0 |

Thus permissions, request acknowledgement, a local abort fence and globally effective cancellation are different facts. The tool-side commit is the outcome oracle, not `aborted:true`, stream finish, model count, or controller signal. Remote fencing is observed effective in this ordering only; no general race guarantee follows. The 500 is current behavior, not a recommended public cancellation error. Relevant merged code: `packages/core/src/agent/durable/durable-agent.ts:2812` and `:2837`.

**Recommended semantic target:** successful global cancellation fences every subsequent approval/resume admission from the shared snapshot before reporting effective cancellation. It cannot roll back already committed effects. Preserve legacy acknowledgement separately if compatibility requires it; do not silently reinterpret `{aborted:true}` as proof that shared execution is stopped. Same-ID ordinary approval resume uses one run topic, unlike until-idle autonomous continuation's new IDs.

## 4. Four retention layers, independently tested

| Layer removed after finish | Actual local / remote result |
|---|---|
| native Redis stream only | plain 200/200 replay; wrapped 200/404 |
| replay list only | plain 200/200 replay via remaining native transport; wrapped 200/404 |
| **both history layers** | plain **200/open/0 bytes** on both; wrapped **200/open/0 bytes locally**, remote 404 |
| shared plain ownership record only | plain **404/404**, retained output still exists |
| durable execution snapshot | not independently force-deleted in this probe; parked remote approval establishes shared resumability; ordinary finished runs already remove snapshots |

Each eviction is on a **fresh finished run**, not cumulative deletions. Both-history deletion returns Redis delete count 2. Observe uses offset 1; measurement bounded to 1.2 seconds. Open response does not prove an infinite hang; current route has a five-minute idle timeout. Natural post-cleanup checks after 31.5 seconds yield 404, a different condition from early history loss with ownership still present.

The attempted plain-style owner-key deletion on DurableAgent returns **delete count 0** because that shared key is absent: **not a valid durable ownership eviction test**. It is reported as negative evidence, not a successful eviction.

Native transport retention is not replay-cache retention. Replay cache is not execution storage and not a durable log. Shared owner metadata proves access, not history completeness; snapshots prove recovery state, not output availability. `packages/core/src/events/topics.ts:38` gives a 24-hour run-log TTL, while actual finished cleanup is normally 30 seconds (`packages/core/src/agent/streams/constants.ts:66`); a TTL is a ceiling, not promised replay retention.

## Proposed minimum contract matrix (target, not current implementation)

Same policy on executor and peer; differences above are current defects/limitations.

| State | Watch: local AND remote | Stop: local AND remote |
|---|---|---|
| running | authenticated owner + current MEMORY_READ/thread/FGA checks; replay retained range then live | independently require MEMORY_WRITE; acknowledgement distinct from effective cancellation |
| suspended / approval parked | same READ checks using verifiable shared ownership/snapshot; remain attached across same-run resume | WRITE + shared resume-admission fence; report effective cancellation only when fence established |
| resumed same ID | continue same segment/topic and cursor; revalidate owner/thread authorization on attach | WRITE + current execution control; fence survives process boundary |
| autonomous continuation | previous segment may finish; observing initial ID does **not** imply observing new ID | stop segment only unless separately approved session-wide stop contract |
| finished, replay available | verified shared owner retained exactly through replay cleanup; terminal replay then close | no false successful stop; finished run `{aborted:false}`; read proof never grants WRITE authority |
| history missing but ownership valid | explicit authenticated history-unavailable/gap outcome, not a success-looking empty stream or fabricated complete replay | access still distinct; stop only if execution exists |
| expired / cleaned / unverifiable ownership | 404 for absent record; fail closed on unavailable/unverifiable proof with existing route semantics, never serve raw retained bytes | no fallback bypass; preserve existing 404/503/403 distinctions where applicable |

Cross-cutting: authenticated owner equality first; RequestContext is server-authenticated; thread ownership + current FGA permission required for threaded runs; anonymous and other tenants never gain output/control. Reader does not become writer. A lifecycle record is evidence to run the existing authorization checks, not an authorization verdict to cache forever. Use a shared per-agent record with immutable run association, status and generation/publisher identity. Cleanup must compare the generation before deletion so a delayed old-segment cleanup cannot remove newer ownership. Record TTL and heartbeat/renewal must not expire ownership while its replay remains intentionally advertised; partial writes and transport/cache outages must fail closed.

### Ownership-generation safety gate — design only

The supported contract still requires globally unique run IDs across agents on the shared bus. This investigation does **not** approve run-ID reuse, collision recovery, or a replacement collision architecture. Nevertheless, a stale shared READ record must never become authorization for unrelated bytes if a same-ID execution is accidentally admitted or state is corrupted.

Before implementation, specify and prove **all** of these conditions; generation-checked deletion alone is insufficient:

1. Ownership proof identifies immutable `(agentId, runId, executionGeneration)` and the owner/thread scope. Generation must be allocated by trusted execution admission, not a client-supplied timestamp/claim. Replay/live envelopes and lifecycle metadata must bind to that same execution identity. A READ authorizer cannot just accept any historical owner record found by `runId`.
2. Admission must reject an already used/conflicting run identity under the uniqueness contract, including a retained terminal identity. If a future product explicitly supports reuse, its protocol must atomically fence the prior generation and invalidate/replace its ownership proof **before** publishing or exposing any new-generation output. That is additional design scope, not an approved implementation here.
3. Authorization and subscription must be bound to the same verified generation. Recheck or fail/close when generation changes between owner lookup and replay/live subscription; never continue under an old owner's grant into a newer generation. If shared cache and transport cannot enforce or verify that binding, deny/terminate rather than use process-local ownership or replay presence as a substitute.
4. Cleanup must compare-and-delete **only** the ownership proof for the exact generation/publisher it is cleaning, and clear only matching replay. An old cleanup must not delete a newer proof. Conversely, a newer generation must not inherit an old proof because a cleanup was delayed or lost. TTL alone, unconditional delete, and a publisher-identity check only at cleanup do not establish this property.
5. Gate with an adversarial stale-record fixture: generation G1 belongs to Alice; attempt G2 under the same agent/run ID for Bob; Alice must never receive G2 frames using G1 proof. Also test cross-agent same-ID misuse, generation flip between authorization and subscription, stale cleanup, partial record/output writes, and cache outage. Under the currently supported unique-ID contract, rejection of G2 is the expected admission outcome; the synthetic injection tests defensive authorization, not a supported collision flow.

These are acceptance criteria and unresolved protocol choices, **not a coded solution**. A minimum ownership fix must not claim safety merely from matching run ID, copying the plain owner record, keeping metadata for 30 seconds, or adding compare-delete at cleanup.

## Phases and options requiring approval

1. **Recommended first implementation slice: COR-1512 only.** Extend/reuse lifecycle ownership records for wrapped engines in shared server cache; retain finished READ metadata until the corresponding replay cleanup, while leaving WRITE/snapshot/control authorization separate. On no shared cache, do not promise cross-process replay. Define ordering (owner proof established before replay advertised), cleanup identity, outages and expiry test gates first. No runtime change is included here.
2. **Recommended contract slice:** document segment-scoped observation and bounded best-effort replay; define an authenticated history-gap outcome. Choose public wire form before implementing (e.g. a dedicated 410 response before stream start or structured terminal replay-gap after headers; exact wire compatibility still needs review). Unknown/unauthorized requests must not reveal history existence through this outcome.
3. **Separate cancellation slice:** shared fence checked by every approval/resume path plus clear acknowledgement/effectiveness semantics. Reproduce local-ack/remote-side-effect regression before any claim of global stop. This changes execution semantics and must not be slipped into the ownership fix.
4. **Optional larger alternative:** whole-until-idle session reconnect. Requires stable public session identity, ordered segment manifest, per-session cursor and cleanup/terminal rules across SDK/server/engines. Defer unless required; neither a shared owner cache nor a topic rename solves it. A durable output log is an additional product/infrastructure decision, not a replay-cache tweak.

## Required implementation gates

- Two actual HTTP processes sharing real Redis; unique run IDs across agents; identical live/finished replay to authorized owner; tenant/anonymous denial; threaded resource ownership and live READ-vs-WRITE FGA checks.
- Default Agent(durable:true), DurableAgent and evented; generate/stream, approval resume and until-idle where supported; honest unavailable/unsupported cases. Reuse existing harness/suite conventions rather than mock away the boundary.
- Finished retained replay before/after cleanup; explicit cleanup, natural expiry, owner write/read failures, cache-disabled configuration, partial history loss, terminal frame loss, offset/cursor gap, old-generation cleanup after resume, cross-agent run-ID misuse.
- Approval cancellation: local and peer HTTP control, direct local fence, same shared snapshot, approval/resume racing abort; real tool-side effect barrier proves no *new* execution after effective cancellation. Never equate HTTP acknowledgement with side-effect prevention.
- Session proposal only: returned public identity reconnects through every real sequential continuation and final session terminal event. Segment-only contract: prove it ends at first finish and does not claim whole-session delivery.

## Verification and limits

Fresh merged-source forced builds: **31 successful / 31 tasks**. Existing Hono HTTP auth suite: **4/4 tests pass**, `server-adapters/hono/src/__tests__/run-access-http.test.ts:43` (real TCP/Agent, in-memory storage and policy fixture; not independent two-process Redis FGA evidence). All investigation scripts exercised actual running code; no production TypeScript edits, so no new production typecheck delta was introduced.

Not run: full monorepo suite; production/staging; Inngest/external engines; exhaustive generate/adapter matrix; cross-process threaded FGA matrix; concurrent abort/approval stress; transport emulator beyond local Redis. Approval cancellation probe specifically covers DurableAgent, not all engines. Do not generalize these findings to untested adapters or durability guarantees. PR3 delivery/failure work remains independent; no branches merged into this investigation. Durable execution remains opt-in, `Agent.durable` remains resumability only; no worker dispatch, durable-by-default, admission caps, namespace rename, dependency/checker edits, or reopened collision architecture.
