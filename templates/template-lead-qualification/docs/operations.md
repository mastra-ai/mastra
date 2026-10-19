# Running and verifying qualification

Use the runtime declared in `package.json` (Node 24). The install path is `npm install`; its dependency-free postinstall creates the local directory and copies the environment example only if `.env` is absent. Existing configuration is preserved. All direct Mastra dependencies use `latest`; the lockfile records the installation tested for this template.

Use standard `npm run dev`, `npm run build` and `npm start`. Development serves Studio and the API on port 4111. Run commands from the template directory. The application resolves the native CLI working-root hint to the enclosing project directory, so both standard dev and start use the same persistent `data/` directory even though their generated servers run elsewhere. Stop one process before starting another. A production process defaults to Attio input/output and needs the configuration guide's Attio and authentication settings plus HTTPS ingress. Supply an explicit configured pair for a different production integration.

The standard Mastra server handles HTTP. The server starts the registered lead dispatcher through Mastra's worker lifecycle, including recovery before the next event arrives. Merely importing configuration for a build does not dispatch pending work. Dispatch records the stable run ID before native execution. On restart it reconciles a stored successful workflow, restarts interrupted running snapshots, starts work with no snapshot, and resumes suspended review/output steps only through persisted decisions and authorization. Direct native calls cannot supply the private trusted dispatch binding or create an operational association.

The native server owns SIGINT/SIGTERM handling. It stops accepting connections and gives in-flight HTTP requests up to five seconds to finish, then shuts down Mastra. Mastra stops the lead dispatcher before closing storage; storage flushes telemetry before releasing the LibSQL and DuckDB handles. A request that exceeds the drain window may return a transport error; replay the same event ID after restart to discover whether its durable association committed. A second signal is a forced-exit request under the native server policy. SIGKILL recovery uses the same mechanism for accepted pending work. Deployment requires one process and persistent disk; multiple replicas and ephemeral/serverless storage are unsupported.

## Checks

Run the focused suites before broader execution:

```sh
npm test -- tests/unit
npm test -- tests/integration
npm run format:check
npm run lint
npm run typecheck
npm run build
```

Integration tests use isolated temporary persistent databases, the native Mastra HTTP adapter, controlled failures and a real child-process SIGKILL/restart. They make no OpenAI or Attio calls. Tests and fixtures are under `tests/`; no live service credentials are required.

## Backups and rollback

Stop the process, then make a consistent backup of the whole `data/` directory before changing persisted schemas or reverting application code. Driver organization does not rename tables or rewrite existing data. The selected Attio input owns inbox initialization; local-only startup leaves any existing Attio tables untouched. Schema changes are additive and have no destructive migration. Qualification, round, reservation, cycle, review and output tables leave earlier intake rows and immutable qualification snapshots intact. Review/output rollback must preserve pending packets, versioned readable local reports and the operation journal. Untagged legacy local patches and prior Attio projection versions retain their exact authorized interpretation. An already applied destination write is not undone by reverting code. Reverting to the earlier scaffold leaves the ignored data files for diagnosis, but that scaffold cannot resume intake. Restore this implementation with the same data to recover pending runs. Do not delete accepted operational data during rollback.

There is no destructive retention command in this version. For disposable development data, stop the server and explicitly choose whether to archive or remove it. Production use needs an operator-managed data lifecycle until retention maintenance is implemented.

Customization prompt:

> Adapt operations for [deployment] while preserving standard Mastra dev/build/start, one process, persistent LibSQL/DuckDB files, production authentication and durable replay. Keep operational scripts in scripts/ and tests under tests/. Test acceptance-to-dispatch interruption with an actual child-process kill, successful restart and exactly one logical run association. Document shutdown, backup and schema rollback behavior.

## Research recovery and interpretation

The native lead-intake workflow records intake, then runs qualify-company. New snapshots use ordered missing-attribute rounds within the qualification step. Trusted inbound inquiry evidence is considered first; public research then targets model, workforce and headquarters gaps. The default plan performs no public buying-intent search. Completed round results and count diagnostics are persisted independently; restart reuses them and the immutable final assessment without repeating saved paid work. In-flight attempts with unknown usage retain reservations. The absolute processing deadline is set once, independently of queue wait, and remains unchanged across restart. No provider/model fallback occurs.

Short atomic SQL batches record reservations and counters together without holding a write transaction across JavaScript awaits. The application database remains authoritative for decisions and budget allowance; DuckDB is technical observability only. An output/export failure cannot authorize another research allowance. The read route exposes conservative search, page, output-token, compressed-byte and decoded-byte consumption. Check its structured failures before submitting a deliberate new cycle; never edit old counters or historical scores.

Each targeted round retrieves at most one useful approved page returned by search, then extracts and verifies using that page plus earlier authorized evidence. The first actual search uses official company domains; later searches may use configured additional domains. Within returned approved URLs, official and target-relevant paths take priority. Previously inspected URLs are skipped. A follow-up never starts without retrieval allowance and remaining downstream model headroom. Failed pages, redirects, duplicate content and retries share the four-request allowance; oversized responses are discarded completely. Page size failures retain only the failure phase, declared length when valid, encoding category, observed byte counters and cap. Candidate rejection diagnostics distinguish unknown evidence IDs, absent exact quotes and semantic-support rejection, retaining typed proposed values, hashed IDs and validation checks. These diagnostics contain no page content or quotations. Round URL outcomes retain only sanitized URLs without query, fragment or credentials. Research does not guarantee headcount or headquarters will be available. Employee intervals crossing a policy boundary, accepted contradictory values, rejected-only facts and undated buying requests remain uncertain. Independent firmographic support survives rejected restatements, while every rejection remains available for diagnosis. No usable source material after provider failure or exhaustion produces a failed diagnostic assessment; partial successes remain reviewable. Completed research proceeds to apply-or-review, which journals local output or suspends for a published review. See [review and output](review-and-output.md) for decisions, reconciliation and linked requalification.

## Separate live verification

Default tests explicitly select unit and integration folders and use controlled provider/page material. The live configuration is opt-in and has no credential-based skip. After configuring OPENAI_API_KEY and explicitly approving a real request run, use:

```sh
node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.live.config.ts
```

This selects researches_real_company_with_filtered_responses_and_bounded_usage on attio.com. It permits at most four hosted searches, four HTTPS GETs including redirects/retries, 12000 aggregate model output tokens, 180 seconds of processing, 2 MiB compressed/decoded per response and 8 MiB aggregate per byte dimension. The retained evidence excerpt remains limited to 24000 characters. It captures bounded raw completed-call metadata and fails if the provider exceeds the declared per-request search ceiling, usage is unavailable, or no real supported material is obtained. This scenario also requires an accepted b2b_saas classification with a persisted matching inference and exact supporting passages linked to the fact and named source evidence. An unrelated accepted fact or a direct-only classification does not satisfy the inference proof. Safe diagnostics include targeted-round reasons/counts, employee interval, observed/inferred basis, headquarters country and sanitized URL outcomes/gap codes, score and contribution states. Other missing company facts may still yield needs_review. The test uses a dedicated temporary operational/telemetry directory and removes it, including source excerpts, in finally after shutdown. No CRM is contacted. A failed live proof remains a failed proof; controlled fixtures cannot substitute for it.
