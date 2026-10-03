# Editorial review with Mastra and Render Workflows

A user submits a draft, three reviewers run in parallel, and a final step produces a revision. The browser receives a job ID, polls status, reconnects after refresh, and can cancel. The backend derives ownership from authentication and checks it before lookup/cancellation. The worker uses ordinary Mastra steps and agent calls. The provider dispatches them as native Render tasks.

The default `deterministic` mode makes no model calls. Its feedback is fixed diagnostic feedback and its revision normalizes whitespace; it is deliberately labeled in the interface. Agent mode uses real Mastra agents when explicitly configured.

## Install the local package

From `workflows/render/`, after the provider's dependencies are installed:

```sh
export TMPDIR="$PWD/.scratch/tmp"
export npm_config_cache="$PWD/.scratch/npm-cache"
npm run build --workspaces=false
npm pack --workspaces=false --pack-destination .scratch
npm install --prefix examples/editorial-review --workspaces=false --install-links --ignore-scripts --no-audit --no-fund
npm install --prefix examples/editorial-review --workspaces=false --no-save --ignore-scripts --no-audit --no-fund "$PWD/.scratch/renderinc-mastra-0.0.0.tgz"
```

The example declares a local file dependency because the integration is unpublished. Installing the archive explicitly verifies the packed artifacts. No workspace aliases to provider source are used.

## Configure and run

From `examples/editorial-review/`, copy `.env.example` to `.env`. Set:

- `DATABASE_URL`: a PostgreSQL database reachable by the backend and worker. The provider and Mastra snapshots share it.
- `APP_BUILD_ID`: the same immutable code/build identity on both processes.
- `RENDER_WORKFLOW_SLUG`: the local or deployed Workflow service slug.
- `DEMO_API_TOKENS`: a JSON map of demo usernames to random tokens of at least 16 characters. Enter one token in the browser. These are example credentials, not a production authentication system.
- `RENDER_USE_LOCAL_DEV=true` and `RENDER_LOCAL_DEV_URL=http://127.0.0.1:8139` for local development.

Start the Render development worker from this example directory:

```sh
render workflows dev --port 8139 -- node --env-file=.env node_modules/tsx/dist/cli.mjs worker.ts
```

In another terminal, from the same example directory:

```sh
npm run start --workspaces=false
```

Open `http://127.0.0.1:4318`. Connect with a configured token, submit a draft and wait for the result. Refresh during execution to reconnect using the job ID. The token lives in browser session storage; the job ID also lives in the URL and local storage. Neither a Render API key nor a database credential is sent to the browser.

To exercise failure reporting, select the demonstration-failure checkbox. To cancel, submit and immediately select Cancel. A fast job can complete before cancellation reaches Render; the interface reports the final provider outcome.

## Optional real agents

Set `REVIEW_MODE=agent`, `REVIEW_MODEL` to a model ID supported by the pinned Mastra version, and that model provider's credentials in the worker environment. Restart both processes with the same updated build identity. The same graph then calls worker-local `reviewer` and `editor` Mastra agents with structured output. A child retry can repeat a model call and its cost. Hosted real-agent generation with `openai/gpt-4.1-mini` passed on 24 September 2026; see the [validation record](../../docs/hosted-validation.md).

To exercise the live-agent path on your deployed service, set `DEMO_BASE_URL` and `DEMO_TEST_TOKEN` in your local test environment and run from the integration package directory:

```sh
TMPDIR="$PWD/.scratch/tmp" TSX_DISABLE_CACHE=1 \
  node node_modules/tsx/dist/cli.mjs scripts/hosted-agent-smoke.ts
```

This submits one job with three real reviewer calls and one editor call. It refuses deterministic mode and checks structured findings, a changed revision and preservation of the fixture's key facts. Model requests and child retries can incur charges. Set `DEMO_RESULTS_FILE` to retain the synthetic input and output. The script prints the run ID before submission; set `DEMO_AGENT_RUN_ID` to that same ID when reconnecting after an interrupted test. Check native Render run records separately to verify the root and four child tasks. See [hosted validation](../../docs/hosted-validation.md) for observed results and limits.

## Boundaries

### Draft and upload contract

The schema and browser share `input.ts`: drafts allow 100,000 UTF-16 code units after trimming and criteria allow 2,000. This is JavaScript `string.length` and HTML `maxlength`, not a token count or a count of displayed characters. An emoji can consume two units. These input limits do not guarantee that every configured model can process the maximum draft; choose model/context and output budgets for your application.

The HTTP body cap is derived from those limits: `6 × (100,000 + 2,000) + 4,096 = 616,096` raw bytes. Six bytes accommodates every UTF-16 unit written as a JSON `\uXXXX` escape. The extra 4 KiB accommodates field names, the optional UUID, booleans and formatting. Maximum-size ASCII, Chinese, emoji and fully escaped fields therefore fit. Arbitrary unknown fields, repeated keys, excess whitespace (including whitespace trimmed from the draft) and HTTP compression are not part of this payload allowance. Change the shared input contract if your product needs larger drafts; raising only a transport limit does not change the schema.

Authenticated uploads are bounded before parsing, provider lookup or job admission. Deploy-time settings are in `.env.example`; invalid values fail startup. They are example application policies, not Mastra or Render Workflows limits:

| Setting                 | Default | Intended budget                                                                                                                                                                                              |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `UPLOAD_TIMEOUT_MS`     | `30000` | Absolute body-read deadline. A full supported body takes less than 19 seconds at 32 KiB/s, leaving more than 11 seconds of slack. This is a supported test scenario, not a measured user-network percentile. |
| `UPLOAD_MAX_PER_OWNER`  | `2`     | Two overlapping uploads per authenticated principal, such as two browser tabs. A shared team credential shares this allowance.                                                                               |
| `UPLOAD_MAX_CONCURRENT` | `16`    | At most 9,857,536 bytes (about 9.4 MiB) of fixed body buffers while reading. This excludes sockets, decoded strings, parsed objects, requests awaiting job admission and other process memory.               |

The slots count bodies currently being read, not users, uploads per second or running workflows. Completed reads and aborts release slots. The reader validates UTF-8 before decoding once, preserving characters split across chunks and rejecting malformed byte sequences instead of silently altering draft content. Oversized, timed-out and excess concurrent uploads return 413, 408 and 429 respectively and close their connection; 429 includes `Retry-After`. These process-local upload limits complement the PostgreSQL job quotas below. Reads and cancellation do not consume upload slots. Multi-instance deployments need an additional shared or edge-level connection policy.

Verification uses the real HTTP server and real input schema, with workflow submission stubbed to avoid model cost: maximum supported encodings, exact byte boundary, schema rejections, malformed UTF-8, early Content-Length rejection, chunked overflow, two-owner and 16-slot saturation, four subsequent bursts of 16 full-size Unicode requests, abort recovery, and a full escaped draft streamed at 32 KiB/s under the default deadline. Reduced-deadline tests additionally prove that trickling cannot extend the absolute timeout. Run `npm test --workspaces=false -- src/example-uploads.test.ts` from the package directory. These scenarios establish the example's stated behavior, not maximum production throughput. Recheck your instance memory, proxy timeouts, shared credential usage and expected client traffic before changing these settings.

This example defaults to `127.0.0.1` for local evaluation. For a Render web service set `HOST=0.0.0.0` and use the platform-provided `PORT`; see [hosted validation](../../docs/hosted-validation.md) for build/start commands. Before deploying an application, integrate the host application's authentication, TLS and retention policy. The demo uses configured bearer tokens and has no sign-up or token issuance flow. The core provider API assumes a trusted backend, so preserve the ownership checks when adapting it.

It uses custom HTTP routes calling the **core** `run.startAsync()`, which waits for remote acceptance and persistence. The client receives 202 only after that succeeds. Submission uncertainty is reported with the existing job ID and does not trigger automatic resubmission. The browser allocates and saves the job ID before submission, so a lost HTTP response can be reconciled by lookup. Repeating a request with the same ID and input retrieves the existing submission instead of creating another. Changed input or a different owner is rejected. Refresh and backend restart retrieve that same run.

No percentage progress, token streaming, workflow replay or root retry is claimed. A root failure is a failed job. Render completion/cancellation control comes from the provider; business steps do not call the Render SDK directly.

## Submission admission controls

`admission.ts` reserves each new job atomically in PostgreSQL before `createRun`/`startAsync`. Separate server instances share the same limits. Defaults are 5 accepted jobs per owner and 20 globally in a rolling hour, with 2 active jobs per owner and 8 globally. These are application job-count limits, not dollar budgets or Render workspace quotas. Status, history, cancellation and idempotent reconnects remain available at capacity.

Configure `SUBMISSION_WINDOW_MS`, `SUBMISSIONS_PER_OWNER`, `SUBMISSIONS_GLOBAL`, `ACTIVE_RUNS_PER_OWNER`, and `ACTIVE_RUNS_GLOBAL`. Set `SUBMISSIONS_ENABLED=false` to pause new jobs; this returns 503 while reads and cancellation continue. Invalid settings fail startup. Capacity/rate denials return 429 with Retry-After. Storage/provider outages fail closed. Global limits also bound applications where visitors can create new identities.

Accepted reservations remain active until the existing workflow status proves success, failure or cancellation. A cancellation request, missing binding or ambiguous submission does not release capacity. If a process dies between reservation and submission, an operator must reconcile that run ID and verify no native execution was accepted before settling the reservation. Never release an uncertain reservation based solely on its age or retry it as a new job. The additive `mastra_render_admissions` table contains namespace, run ID, owner, input hash and timestamps, not drafts or credentials. Include it in the application's retention/backup policy.

Run the real PostgreSQL admission regression with `DATABASE_URL=... node node_modules/tsx/dist/cli.mjs scripts/admission-smoke.ts` from the package directory. It uses isolated namespaces and deletes only its synthetic reservation rows. Run `DATABASE_URL=... node node_modules/tsx/dist/cli.mjs scripts/admission-recovery-smoke.ts` to verify missing/malformed run isolation, later-batch progress, retained quotas, repair and outage recovery through the actual provider and PostgreSQL with a synthetic Render transport. It never submits native tasks.

Submission requests check ownership, duplicate IDs, the circuit breaker and quotas against PostgreSQL without calling the provider. An independent background pass refreshes at most 100 unsettled reservations with three concurrent lookups. Passes are separated by at least five seconds after completion by default (`reconciliationIntervalMs` in `createAdmission`), including after failures. The cursor advances after every processed batch, including failed lookups, so unknown or malformed runs cannot permanently starve later reservations. Separate application processes have independent refresh bounds.

Only verified terminal provider states release capacity. Unknown statuses remain reserved; a completed or canceled job can therefore occupy capacity until its background refresh runs. A Render SDK `ClientError` with status 404, `RenderProtocolError`, or `RenderRunConflictError` from a single run lookup leaves that reservation active for retry on the next sweep; it does not block unrelated admissions that fit the quotas. Classification uses the error name and, for `ClientError`, status code, so separately installed SDK copies behave consistently. It applies only to status lookup errors, never settlement database errors. Authentication, rate limiting, transport, database and unclassified errors block new reservations with 503 after that instance observes the failure. Admission reopens only after a complete sweep without these failures; a clean later batch alone cannot clear an earlier outage. Duplicate reconnects remain available. Logs summarize failed lookups without including run payloads or credentials. Repeated rejected requests never start or accelerate a refresh. The server drains HTTP handlers, then stops and drains admission maintenance before closing provider persistence and Mastra storage.

### Operator recovery for an interrupted reservation

Use this only for a specific reservation with no native provider binding. The provider creates its run record before calling Render, so a record may exist without a `providerId`. An unbound record in `submitting` or `submission-unknown` can still represent an accepted native execution. Neither that status nor a missing task ID proves non-acceptance. Keep the reservation active unless independent evidence establishes that Render accepted no execution. Increasing the cap or releasing by age is not reconciliation.

This transaction is specific to the included example, whose admission namespace is its workflow ID (`namespace: editorialReview.id` in `server.ts`). It checks the supplied workflow ID against that stored namespace and uses the namespace to find provider records. If your application uses a different namespace mapping, do not use this SQL unchanged; use a stored or independently validated workflow-to-admission mapping.

1. Set `SUBMISSIONS_ENABLED=false` on every caller, deploy it, and drain or stop all in-flight submission handlers. Verify new submissions return 503 while reads and cancellation work. The database lock below cannot by itself stop a handler that already reserved capacity and is about to submit.
2. Inspect the exact namespace/run ID, persisted run record, application logs, and Render task history. Record the operator, timestamp, run ID, and evidence in the incident record. If acceptance or a live submitting handler cannot be ruled out, stop and keep the reservation active. A `providerId` or `workerClaim` rules out this procedure; reconcile that execution through the provider instead.
3. After proving the caller cannot resume and Render accepted no execution, run this transaction with explicit `psql` variables `namespace`, `workflow_id`, and `run_id`. It permits an absent record or an unbound, unclaimed record still in `submitting` or `submission-unknown`. It touches at most one reservation, retains the row for idempotency and rate accounting, and prints the settlement for the audit record. The SQL guards do not replace the operator's evidence of non-acceptance.

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('mastra-admission:' || :'namespace', 0));
UPDATE mastra_render_admissions AS admission
SET settled_at = now()
WHERE admission.namespace = :'namespace'
  AND admission.namespace = :'workflow_id'
  AND admission.run_id = :'run_id'
  AND admission.settled_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM mastra_render_runs
    WHERE workflow_id = admission.namespace AND run_id = admission.run_id
      AND (
        record->>'providerId' IS NOT NULL
        OR record->>'workerClaim' IS NOT NULL
        OR COALESCE(record->>'status', '') NOT IN ('submitting', 'submission-unknown')
      )
  )
RETURNING namespace, run_id, created_at, settled_at;
COMMIT;
```

4. Verify the expected single row was settled, save the output with the evidence, then reopen submissions. Do not delete the reservation or retry the original ID. Any unbound run record is retained unchanged and may still display its original submission status; this operation only releases admission capacity. Any new work requires an explicit new submission; this procedure does not perform one.

Run `scripts/recovery-sql-smoke.ts` with a disposable PostgreSQL connection to test the exact SQL above. It uses temporary tables and checks unbound recovery, protection of bound/claimed runs, namespace/workflow isolation, idempotency, and preservation of run records and results. Operator evidence and draining remain manual prerequisites.

On deployment, keep model keys in the worker, Render caller credentials in the backend, and use HTTPS for browser traffic. Rotate configured demo bearer tokens by updating all callers; they have no automatic expiry or revocation service. Draftroom's separate application uses server-side sessions instead. Cancellation requests Render to stop in-flight tasks, but cannot undo an external effect that already occurred. Check the terminal native outcome before releasing capacity or claiming cancellation succeeded.
