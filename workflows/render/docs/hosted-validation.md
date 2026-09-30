# Hosted validation

## SDK 1.2.0, nested graphs and root restart retries, 30 September 2026 UTC

Runtime commit: `471fb0361713482fe910e56a7d6d3a44bbc45392`, pushed directly to `ojusave/main` and proposed in [PR #25515](https://github.com/mastra-ai/mastra/pull/25515). All implementation remains inside `workflows/render/`.

The existing paid integration-test Workflow `wfl-daq7jmh42hec738ka3c0` ran version `wfv-dau813id0e5s73el0230` in the `samples` workspace. Its entrypoint is `scripts/native-worker.ts`; the worker has neither a `RENDER_API_KEY` nor local-development flags. Test callers ran in paid one-off job `job-dau81r093c1s73d48mdg`, which succeeded, using the private connection to PostgreSQL `dpg-daq7hlp42hec738k2l6g-a` (paid `0.1c-256mb`). No free resources were created. Draftroom's deployed web application and Workflow were not changed.

The caller fetched runtime/test sources from the exact commit and checked SHA-256 hashes before installing the locked dependencies. These were actual native Render tasks, PostgreSQL persistence and a real Mastra agent call, not mocked task dispatch.

| Scenario       | Native root                     | Outcome  | Root attempts | Native runs in tree |
| -------------- | ------------------------------- | -------- | ------------- | ------------------- |
| cancel         | `trn-08l4gdau825ugekts73dbq0mg` | canceled | 1             | 4                   |
| agent          | `trn-08l4gdau82afavr4c738333v0` | success  | 1             | 5                   |
| success        | `trn-08l4gdau82fpsrm7s73b5smp0` | success  | 1             | 5                   |
| child-retry    | `trn-08l4gdau82l5g1s2s73brcha0` | success  | 1             | 5                   |
| nested-failure | `trn-08l4gdau82rlg1s2s73brdcn0` | failed   | 1             | 4                   |
| root-crash     | `trn-08l4gdau8316k1f9s73aodij0` | success  | 2             | 9                   |
| root-timeout   | `trn-08l4gdau83e2d0e5s73el90b0` | success  | 2             | 9                   |

For a successful graph, Render ran one parent coordinator, its preparation step, one nested coordinator, the nested leaf and the final parent step. Assertions verified native ancestry, sequential state/context, initial input, prior-step output, public run IDs and retrievable Mastra results. The child-retry case executed the leaf twice while preparation ran once. Permanent nested failure prevented the final step.

The root-crash case exited the coordinator process with code 23 after all business steps completed. The timeout case blocked at the same point until Render terminated the attempt. Each native root retried once, reran its graph from initial state, produced a separate nested run and snapshot, and succeeded. These are whole-graph restarts: completed effects ran again. They do not demonstrate checkpoint replay or exactly-once execution.

The agent case called a worker-local Mastra `Agent` using `anthropic/claude-haiku-4-5-20251001` inside the nested leaf and returned a nonempty explanation of idempotent side effects. Each task completed in one attempt. Provider credentials came from the user's existing Render configuration and were never placed in source, task arguments or the browser.

Cancellation was independently checked after the root became terminal: the root, nested coordinator and active leaf were all `canceled`; the already-completed preparation step stayed `completed`. A hosted test of the initial implementation exposed a race in which coordinator guards reported failure while Render canceled descendants. The fix stops application work and lets native cancellation terminate the handler, bounded by the existing coordinator deadline. The final scenario above verifies the corrected behavior.

Additional hosted checks:

- SDK 1.2.0 supplied task/root/parent IDs to both a root and a child. Repeating a submission with the same native idempotency key and pinned Workflow version returned the original run `trn-08l4gdau79pugekts73d8qtug`. The documented deduplication window remains 24 hours per Workflow version.
- Replaying a completed generated-child payload as a native root failed before business execution in `trn-08l4gdau837nlot8c73a29t20`. Both native attempts reported that an active coordinator had not authorized dispatch. Unit tests additionally reject the wrong native parent/root while a coordinator is active and revoke superseded ancestor attempts.
- All 172 package tests, build and typecheck passed. The packed example typechecked and passed maximum-size Unicode input, ownership checks, backend restart/reconnect, failure and cancellation through real local tasks. Local fixtures also passed both loop operators, nested graphs, child-only retries, root process loss and PostgreSQL compare-and-swap checks.

CLI 2.28.0 omits native metadata. Explicit local mode retains signed dispatch for ordinary graphs/nesting; root retries fail explicitly without native IDs. A local lifecycle test first exceeded its 45-second fixture wait while the native run completed in 49 seconds. With a bounded 180-second wait, reconnect, cancel and root-loss checks passed without changing their assertions.

Before the final hosted job, local external PostgreSQL attempts failed before submission (TLS required, then connection termination). Moving the caller to Render's private network avoided that connection path. Two job launchers also failed before task submission: an incorrect source path, then a redundant TypeScript compile exceeding the 512 MB job's Node heap. The final launcher checked the same committed sources and ran them with `tsx`; the Workflow had already built successfully on Render. These launcher failures are not successful runtime checks.

This validates the listed scenarios, not deploy-during-run recovery, every infrastructure failure, workspace saturation, agent tool loops, unpublished Mastra core compatibility or full Studio streaming. Coordinator replay, suspend/resume and token streaming remain unsupported. Root retries remain disabled unless the application opts in.

The remaining sections record earlier validation and may describe older versions, resources and limitations.

Hosted validation passed in the `samples` Render workspace, using a dedicated Workflow service, web example and PostgreSQL database. Deterministic lifecycle checks passed on 23 September 2026 (24 September UTC), after fixing two hosted defects. A real Mastra agent workflow using OpenAI GPT-4.1 mini passed on 24 September 2026. The live example is now configured in agent mode.

The fork branch is `feat/render-workflows`. Deployment configuration is confined to this package.

## Deterministic deployment and results

- Tested application commit: `d1e31106f37626076ce9e70805948742491f7cb0`.
- Workflow: `wfl-daq7jmh42hec738ka3c0`, version `wfv-daq7s3p42hec738lcmn0`, status `ready`.
- Web: `srv-daq7jrh7lnhs73bvkco0`, deploy `dep-daq7s3tg1s2s73fflkb0`, status `live`.
- PostgreSQL: `dpg-daq7hlp42hec738k2l6g-a`, PostgreSQL 17, Oregon, free test instance.
- [Hosted example](https://mastra-render-integration-test-web.onrender.com) and [web service configuration](https://dashboard.render.com/web/srv-daq7jrh7lnhs73bvkco0).
- Caller and worker use the same immutable build ID. The worker has no `RENDER_API_KEY`.

| Check                   | Observed result                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP contract           | Health, authentication, input validation, asynchronous acceptance, duplicate ID/input, conflicting input and cross-user lookup/cancel checks passed      |
| Native graph            | One root and four successful children, with actual parent IDs; the three review task runs overlapped for 4.83 seconds                                    |
| Failure and retry       | Clarity review failed after two attempts; successful siblings each ran once; revision was not dispatched; root failed after one attempt                  |
| Native paused status    | Lookup returned HTTP 200 and Mastra `running` while the native root waited for children                                                                  |
| Cancellation            | Immediate cancellation passed; a separate active-root cancellation canceled all three review children                                                    |
| Web restart             | Render replaced instance `n78x8` with `mzvxd`; a job submitted before restart completed and was retrieved by the new backend with the same ID and result |
| Completion notification | A subscription established before completion received the native completion event                                                                        |
| Local regressions       | 39 tests, strict typechecking and packaged example build passed                                                                                          |

Key run identities:

| Scenario               | Mastra run ID                          | Render root ID                  |
| ---------------------- | -------------------------------------- | ------------------------------- |
| Success                | `be38ef29-76d5-43ff-a764-6c5cd6d112d7` | `trn-08l4gdaq7t75g1s2s73ffp8i0` |
| Failure and retry      | `7806765c-a4a9-4e4d-9e65-6bcadd10f0b7` | `trn-08l4gdaq7tb142hec738lhme0` |
| Immediate cancellation | `da6b3033-fbb5-4e9b-aa86-197576d287bf` | `trn-08l4gdaq7teh7lnhs73c0ptjg` |
| Active cancellation    | `c3980916-2713-47a7-86ec-ba14c41436c3` | `trn-08l4gdaq7tlp7lnhs73c0qnig` |
| Backend restart        | `f7dd6599-3926-4c1a-ba03-48b6acc2b447` | `trn-08l4gdaq7uap7lnhs73c0stdg` |

[Machine-readable observations](hosted-results.json) retain native child IDs and attempt counts. An additional diagnostic subscribed only after completion and received no historical event within 30 seconds. Do not assume event replay; the provider checks status before subscribing and falls back to polling after a bounded wait.

## Real-agent validation

The same application code at `d1e31106f37626076ce9e70805948742491f7cb0` completed a real-agent job on hosted Render. The example's Mastra `reviewer` agent performed three parallel `generate()` calls, followed by the `editor` agent's `generate()` call. All used `openai/gpt-4.1-mini` and structured output. The provider source needed no changes for this test.

| Identity             | Value                                  |
| -------------------- | -------------------------------------- |
| Application build ID | `d1e31106-agent-gpt-4.1-mini-v2`       |
| Workflow version     | `wfv-daqj3k2d0e5s73ap1hfg`             |
| Web deploy           | `dep-daqj3k8473hc738bikgg`             |
| Mastra run           | `5d0f192c-c446-4b8b-bb3f-1145bbe5039a` |
| Render root          | `trn-08l4gdaqj5gojo6nc73ekttd0`        |

The root and all four children completed on their first attempt. Native child results matched the three findings and final revision returned through the application API. The generated revision preserved the opening year, day, time, free clinic and no-ticket requirement while removing repetition:

> Our museum, opened in 1998, offers a free repair clinic every Friday at 3 p.m. No tickets are required to attend.

The first credential tested could list models but had no credits for generation. That job failed and the application surfaced the provider error correctly. An existing credential supplied from the authorized Render workspace passed a small real Mastra generation preflight and then the full hosted workflow. No key value was printed, committed or saved to local test files. `OPENAI_API_KEY` is configured only on the worker; `RENDER_API_KEY` remains only on the web caller.

The `agent` section of [hosted-results.json](hosted-results.json) retains the synthetic input, generated findings/revision, task IDs and attempts. This is evidence for one real structured-generation workflow, not a model-quality benchmark. Agent tool loops, memory, streaming and other model providers were not exercised.

To repeat, set matching `REVIEW_MODE=agent`, `REVIEW_MODEL=openai/gpt-4.1-mini` and a new immutable `APP_BUILD_ID` on caller and worker. Configure the OpenAI key on the worker, release the worker and deploy the web service. With `DEMO_BASE_URL`, `DEMO_TEST_TOKEN` and optionally `DEMO_RESULTS_FILE` set locally, run:

```sh
TMPDIR="$PWD/.scratch/tmp" TSX_DISABLE_CACHE=1 \
  node node_modules/tsx/dist/cli.mjs scripts/hosted-agent-smoke.ts
```

The test makes real model calls and refuses deterministic mode. Reuse its printed ID through `DEMO_AGENT_RUN_ID` after a client interruption; do not blindly submit another paid job.

## Test environment lifetime and remaining limits

The temporary caller API credential expires on **25 September 2026 at 16:59 UTC**. Replace `RENDER_API_KEY` on the web service and redeploy before relying on ongoing submissions. The worker needs no such credential. The demo login uses a tester token from the web service's `DEMO_API_TOKENS`; tokens are deliberately absent from the repository and this report.

The free PostgreSQL test instance expires on **24 October 2026**. The free web service can sleep when idle. Auto-deploy is disabled on both services so later documentation commits do not change the tested application version. This is a temporary test deployment, not a production service.

These checks do not prove durable root replay, hosted root crash/timeout recovery, deploy transitions during active runs, workspace quota behavior, ambiguous submission recovery, production authentication/retention, model quality across workloads or full Studio compatibility. Root retries remain zero, as documented in the package README.

## Reproducible build

Set the service root directory to `workflows/render` and use:

```sh
bash scripts/build-editorial-example.sh
```

The script builds and packs the provider, installs the example's dependencies and then installs the actual provider archive into the example. It does not install the monorepo workspace or rely on a published integration package.

Workflow run command:

```sh
node examples/editorial-review/node_modules/tsx/dist/cli.mjs examples/editorial-review/worker.ts
```

Web start command:

```sh
node examples/editorial-review/node_modules/tsx/dist/cli.mjs examples/editorial-review/server.ts
```

Both processes require matching `APP_BUILD_ID`, `RENDER_WORKFLOW_SLUG` and `DATABASE_URL`, and `REVIEW_MODE=deterministic` for tests without model calls. Set `NODE_VERSION=24.18.0` and `TSX_DISABLE_CACHE=1`. Do not set `RENDER_USE_LOCAL_DEV` for hosted operation.

The web service additionally needs `HOST=0.0.0.0`, a Render-assigned `PORT`, `DEMO_API_TOKENS` with strong random values, and `RENDER_API_KEY` for task submission and lookup. The worker uses the native task context to chain tasks and does not need a management API key. `/healthz` checks the HTTP process; it is not proof that database access or workflow submission works.

Credentials belong in the Render environment and ignored local test configuration. Do not commit connection strings, tokens or populated environment files. The demo's configured bearer tokens remain a demonstration authentication scheme.

## Repeat the application checks

Set `DEMO_BASE_URL` to your deployed example, `DEMO_TEST_TOKEN` to one configured user's bearer token, and `DEMO_OTHER_TOKEN` to a different user's token. Optionally set `DEMO_RESULTS_FILE` to an ignored output file. Then run from the package directory:

```sh
TMPDIR="$PWD/.scratch/tmp" TSX_DISABLE_CACHE=1 \
  node node_modules/tsx/dist/cli.mjs scripts/hosted-smoke.ts
```

This creates three real jobs. It checks health, authentication, validation, asynchronous acceptance, duplicate submission, input conflicts, owner isolation, deterministic output, child failure and cancellation. It refuses agent mode. Job IDs are printed before submission so an interrupted test can reconnect without blindly resubmitting.

## Defect found during hosted validation

The initial deployment at `c708b97a51ec17ce2bbbfdaf57ebb6084e81e2e0` registered successfully, but its first root failed before dispatching children. Mastra's `createRun` calls `getWorkflowRunById` while hydrating the worker run. The adapter unnecessarily reconciled that lookup through the management API, requiring a worker API key.

The fix associates the active handler with its Mastra workflow/run identity and reads the persisted binding for that exact worker-local lookup. Caller lookups still reconcile authoritative Render status. Native child dispatch continues through the task context, and the worker requires no management API credential. The regression fails before the fix and passes afterward.

The next hosted graph completed successfully but polling exposed an unhandled native `paused` status while the root awaited its children. The adapter now treats that status as an active Mastra `running` execution and preserves a pending cancellation. This does not add Mastra suspend/resume. A second regression covers lookup and cancellation through this state.
