# Qualification configuration

Edit `src/mastra/config/qualification.ts` and restart. Its schema validates the complete configuration at startup. Every accepted event atomically captures the effective settings, model, assessment time and configuration digest with its durable association. Edits affect new events; replay and restart retain the original snapshot. Retention settings are reserved operator policy, not an implemented deletion schedule.

## Policy and routing

| Setting                                     | Default                                               | Meaning                                                                                                         |
| ------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `policy.version`                            | `inbound-saas-v5`                                     | Human-readable identifier; bump when behavior changes                                                           |
| `policy.rules.businessModel.categories`     | `b2b_saas`, `other` criteria in configuration         | Allowed labels and evidence criteria; authorizes supported business-model inference                             |
| `policy.rules.businessModel.accepted`       | `['b2b_saas']`                                        | Labels that fit this ICP; every accepted label must have configured criteria                                    |
| `policy.rules.businessModel.points`         | 30                                                    | Points for an accepted business-model label                                                                     |
| `policy.rules.employeeCount.min/max`        | 20 / 500                                              | Inclusive employee bounds; preserve reported intervals                                                          |
| `policy.rules.employeeCount.estimates`      | accept                                                | Supported finite estimates count automatically; review keeps them advisory                                      |
| `policy.rules.employeeCount.points`         | 25                                                    | Points only when the entire interval fits                                                                       |
| `policy.rules.headquartersCountry.allowed`  | BR, US, EU members, GB, IS, LI, NO, CH                | Explicit uppercase country codes in the configuration; service markets or offices do not establish headquarters |
| `policy.rules.headquartersCountry.points`   | 15                                                    | Points for headquarters in an allowed country                                                                   |
| `policy.rules.buyingIntent.acceptedSignals` | demo_request, sales_contact_request, purchase_inquiry | Supported explicit inbound buying requests                                                                      |
| `policy.rules.buyingIntent.maxAgeDays`      | 90                                                    | Inclusive window against captured assessment time; undated/future claims require review                         |
| `policy.rules.buyingIntent.points`          | 30                                                    | Points for a supported recent request                                                                           |
| Firmographic `onMismatch`                   | disqualified                                          | Supported hard-exclusion behavior                                                                               |
| Intent `onNoSignal`                         | nurture                                               | Firmographic fit without observed recent intent                                                                 |
| `policy.onInsufficientEvidence`             | needs_review                                          | Missing, stale, conflicting or unsupported decisive facts                                                       |
| `routing.automaticOutcomes`                 | qualified, nurture, disqualified                      | Authorizes supported outcomes through durable output operations                                                 |
| `routing.reviewOutcomes`                    | needs_review                                          | Moving another outcome here is a supported stricter configuration                                               |

Rule points must be nonnegative integers totaling 100. Country/signal lists are unique; employee min cannot exceed max. Routing is disjoint and exhaustive, and needs_review cannot be automatic. Once identity is resolved, a hard mismatch overrides uncertainty elsewhere. Weights change score contributions, not mandatory criteria. Complete fit scores 100; fit with an inspected nonrecent inquiry scores 70; absent inquiry remains unknown; an excluded-size company can score 75 and remain disqualified. There is no score threshold.

Business-model categories have unique lowercase labels (up to 64 characters) and explicit criteria (up to 2000 characters), with two to ten categories. Search, extraction and independent verification use the same captured definitions. The default `b2b_saas` criteria allow hosted or cloud software used by business customers, including usage-based APIs; the source need not literally say B2B SaaS. `other` requires affirmative contrary evidence, such as a physical-goods or human-services offering. Missing SaaS or customer evidence remains unknown. Employee counts support observed intervals and grounded estimates; headquarters and buying intent require explicit facts.

For another ICP, replace both category criteria and accepted labels, then bump the policy version. For example:

```ts
businessModel: {
  categories: [
    { label: 'consultancy', criteria: 'Human-delivered technical consulting to organizations.' },
    { label: 'product', criteria: 'Selling a product without providing consulting services.' },
  ],
  accepted: ['consultancy'],
  points: 30,
  onMismatch: 'disqualified',
}
```

Accepted snapshots retain their captured definitions, estimates policy and prompts after configuration changes.

## Sources, prompts and limits

| Setting                        | Default                                                          | Meaning                                                                                  |
| ------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `sources.providerIds`          | `['openai-web']`                                                 | Ordered registered providers sharing the same run budget                                 |
| `sources.additionalDomains`    | `[]`                                                             | Additional approved DNS domains; the company domain is always included                   |
| `sources.trustedReferences`    | `[]`                                                             | Exact non-web references trusted for an optional adapter                                 |
| `sources.maxEvidenceAgeDays`   | 30                                                               | Age limit for dated firmographic facts; distinct from signal occurrence age              |
| `prompts.version`              | source-extraction-v10                                            | Captured extraction/verification prompt version                                          |
| `prompts.extraction`           | Text in configuration                                            | Structured candidate extraction from retrieved material                                  |
| `prompts.verification`         | Text in configuration                                            | Separate semantic support check; exact quote matching is also required                   |
| `research.targeted.order`      | businessModel, employeeCount, headquartersCountry, employeeCount | Ordered missing-data rounds (1–10 entries); repeats allow another attempt                |
| `research.targeted.queries`    | Text per target in configuration                                 | Captured search instructions; assessmentTime supplies contextual freshness year          |
| `research.maxSearchCalls`      | 4                                                                | Shared hosted search attempts; optional adapters also consume this discovery allowance   |
| `research.maxPageRequests`     | 4                                                                | Additional HTTPS GETs, counting every redirect and retry                                 |
| `research.maxPageBytes`        | 2097152                                                          | Compressed and decoded bytes per response, checked while streaming; schema ceiling 8 MiB |
| `research.maxTotalPageBytes`   | 8388608                                                          | Shared compressed and decoded byte ceilings; schema ceiling 16 MiB                       |
| `research.maxOutputTokens`     | 12000                                                            | Aggregate reserved/known model output, including reasoning tokens                        |
| `research.maxProcessingMs`     | 180000                                                           | Absolute deadline from first dispatch; restart cannot reset it                           |
| `research.maxRetries`          | 2                                                                | Extra transient-failure attempts within remaining budgets; respects Retry-After          |
| `retention.assessmentDays`     | 30                                                               | Intended detailed operational retention; maintenance is not implemented                  |
| `retention.traceDays`          | 30                                                               | Intended separate telemetry retention; maintenance is not implemented                    |
| `retention.deliveryMarkerDays` | 90                                                               | Intended minimal-marker retention; no deletion job runs                                  |

A search reservation does not authorize an HTTP fetch. Every model call reserves output before execution; extraction has no tools. Interrupted calls with unknown usage consume their full reservations. Unread redirect bodies and interrupted page requests retain byte reservations conservatively. Measured calls release only unused allowance. The read route reports conservative consumption, not billing; a call ceiling is not a dollar guarantee.

For broader coverage, change search/page limits from 4 to 6 and consider increasing total page bytes. Increase output/time limits only when observed gaps justify it. Larger limits can increase latency and cost and cannot overcome provider account restrictions. New runs inspect at most one useful page per targeted round, retaining GET allowance for missing attributes. The provider filter permits the company domain for the first actual search; later rounds may also use configured additional domains. Concise natural queries identify the company and target without repeating filters as Boolean site groups or imposing the year on evergreen pages; the captured assessment year remains freshness context. Approved returned URLs prioritize the company domain and target-relevant paths; no URL is invented. Previously inspected URLs are skipped. Oversized responses are discarded completely; redirects and retries consume the same shared allowance. This does not create a crawler. Lower limits yield visible partial/review results. Never reset stored counters to retry a run; submit a new event cycle after the previous destination is inactive.

The model is explicitly `openai/gpt-6-luna` with Responses routing and `OPENAI_API_KEY`. The provider uses low reasoning effort for search, extraction and verification within the same per-call output caps of 1500, 2000 and 1000 tokens. Reasoning consumes these caps; validated structured output and independent support verification remain required. Transport/model replacement requires capability verification; no fallback occurs. Prompt edits cannot alter deterministic weights or grant CRM access. The summary is assembled from validated facts and deterministic reasons, rather than asking a model to invent additional claims.

## Intake and runtime

Edit `src/mastra/config/lead-ingestion.ts` for admission limits and the local source defaults. Without an explicit `config` passed to `createApplicationRuntime`, local runtime selects generic/local and production selects Attio/Attio (`attio:<listId>` source ID). Pass an explicit configuration to select a custom pair independently of runtime authentication:

| Setting                        | Default       | Meaning                                              |
| ------------------------------ | ------------- | ---------------------------------------------------- |
| `source.id`                    | local-inbound | Trusted provenance and delivery namespace            |
| `source.inputProviderId`       | generic       | Registered input adapter                             |
| `source.destinationProviderId` | local         | Registered output destination; local runtime default |
| `source.crmProviderIds`        | attio         | Accepted reference namespaces, without CRM API calls |
| `limits.maxBodyBytes`          | 262144        | Streamed input-body ceiling                          |
| `limits.maxPendingRuns`        | 100           | Active research/review/output associations           |
| `limits.activeRuns`            | 2             | Concurrent lead dispatches                           |
| `limits.dispatchIntervalMs`    | 250           | Polling interval in milliseconds                     |

Preserve source/destination bindings until pending work completes. Local mode binds to `127.0.0.1`. Production uses `LEAD_QUALIFICATION_MODE=production`, binds to `0.0.0.0` and requires a random `LEAD_QUALIFICATION_TOKEN` of at least 32 characters, supplied as `Authorization: Bearer <token>`. Terminate HTTPS at ingress. Native Mastra/Studio APIs share authentication. Runtime mode is independent of evidence-provider selection. `MASTRA_TELEMETRY_DISABLED=1` disables CLI usage telemetry; application observability persists locally in DuckDB.

Customization prompt:

> Adapt qualification for [market and volume]. Inspect schemas, deterministic scoring and acceptance snapshots first. Change supported country, interval, signal-window, weight, routing, source or budget settings. Keep points totaling 100, uncertainty under review, actual supporting material and shared durable reservations. Add functional boundaries and a new-policy-versus-existing-snapshot check. Update defaults and coverage/cost effects. Keep secrets in environment variables and avoid competing business-rule overrides.

Within returned approved URLs, selection prefers exact search-response citations for the current target, retaining raw results as fallback. The remaining URLs rank corporate pages by research target. Workforce research prefers company/team/careers pages, including career subdomains, over support documentation, customer material, individual job vacancies and headcount taxonomy archives. Headquarters research prefers company/contact/office pages. Ranking does not expand source policy or add search/GET allowance.

Targeted research skips supported decisions and revisits unresolved workforce intervals. Independent accepted firmographic evidence survives rejected restatements; genuine accepted contradictions, rejected-only facts and stale evidence remain uncertain. Every rejection remains available. A round needs search/GET/byte/time allowance and at least 384 output tokens: search reserves 256 for extraction and verification; extraction reserves 128 for verification. These minimum allowances do not guarantee completion.

Employee observations preserve open bounds: `190+` is `{ min: 190, max: null }`. A known minimum above the ICP maximum proves mismatch; an open observation alone cannot prove fit. Keep that source-declared observation when adding a separate finite working estimate. Source freshness, exact passages and independent semantic verification still apply.

The default `estimates: 'accept'` lets a workforce estimate earn points when its entire range fits. Estimates can use approximate numeric counts, lower-only staff statements or a published company team roster. Explain the actual cues, assumptions and uncertainty in `inference.rationale`. For example, a rounded staff milestone may support a working interval allowing for growth; a roster may support an interval allowing for unlisted colleagues. The assumed maximum is an estimate, not a source-declared ceiling, and the source need not state both endpoints. Verification checks whether the cues and transparent assumptions make the range plausible. Estimates without workforce cues or with implausible assumptions remain unsupported. Customer, user or vacancy totals do not establish employee counts. False observed precision and bounds selected merely to fit the ICP are also rejected.

With the other criteria resolved, an accepted estimate and recent inquiry can produce Qualified at 100 points; an old inquiry can produce Nurture at 70. An estimate alone does not require review. Set `estimates: 'review'` for a stricter policy that keeps inferred counts advisory and requires a source-declared count or interval for automatic size qualification. Missing, unsupported, conflicting, stale or boundary-crossing decisive facts still require review unless another supported criterion proves a hard exclusion.

Compatible supported ranges are intersected, preserving known observed constraints and every reference. Disjoint ranges conflict. If inference narrows an otherwise uncertain observation, the result remains inferred. Under review policy, an independently decisive source-declared interval remains the scored fact; compatible advisory estimates cannot remove sufficient observed support. Every estimate and reference remains available for the SDR.

Trusted submitted inquiry evidence is available before planning. A recent dated inquiry can satisfy intent; an old one follows the captured age window. Without inquiry evidence, intent remains unknown. The default public plan researches firmographics only; configure a final `buyingIntent` target only for an approved source capable of substantiating actual purchase requests. A company's demo CTA never establishes intent.

## Review expiry

Edit `src/mastra/config/review.ts` to set `expiryDays` (default 7, whole days from 1 to 365). Each new packet captures its absolute expiry time. Restart and later edits preserve existing packet deadlines and qualification snapshot digests. Expiry closes the review with status Expired while retaining Needs review; it never authorizes final output. See [review and output](review-and-output.md) for local operator decisions and provider extension.

## Optional Attio provider

Only selecting Attio input or output reads `attio.mapping.json` and `ATTIO_API_TOKEN`. Attio input additionally requires `ATTIO_WEBHOOK_SECRET` and initializes its existing durable inbox. A local-only selection ignores unrelated stale/invalid Attio files and environment variables; no Attio client, routes or inbox are initialized. The production default pair fails startup if its Attio configuration is missing or invalid.

An explicit generic/Attio configuration uses JSON intake with Attio output and needs no webhook secret. An explicit Attio/local pair can submit initial local cycles; native Stage review, reopen and linked requalification commands require Attio output. See [driver composition](crm-adapters.md) for independent factory maps, trusted operator/external review and destination capability limits.

Generate the secretless mapping with `scripts/attio-setup.ts`, which plans by default and applies only with `--apply`. Keep mapping and credentials outside source control. See [Attio setup](attio.md) for compact and legacy layouts, authenticated Stage decisions and preserved projections/history. Merely leaving credentials on disk no longer selects the integration.

The optional live proof uses three new automatic cases and one linked requalification, plus a read-only verification of an existing Stage-approved, manually reopened review and its archived history selected by `reviewRunId` in a private live-test JSON file. Pass only its path with a transient `ATTIO_LIVE_CONFIG_FILE` for that invocation; keep these test choices outside `.env`. See [live verification](attio.md#verify-the-paths) for prerequisites, deadlines and observation retries.

For JSON lead intake with complete native Attio review, explicitly add `additionalInputs: ['attio']` alongside the generic/Attio selection and supply the signing secret. This starts the full signed Attio input, including its durable command processing and admission of relevant new list entries. Without this additional input, Attio output can apply automatic results, but uncertain packets have no native Stage command listener. No extra transport or secret is enabled implicitly. Additional inputs must provide their own custom transport; input IDs and source IDs remain distinct.

## Port, reports and retention

`LEAD_QUALIFICATION_PORT` optionally selects an integer port from 1024 through 65535 (default 4111). Local mode still binds loopback; production authentication is unchanged. A separate unused port lets the fresh-copy proof run without touching an existing service.

`qualificationConfig.retention.assessmentDays`, `traceDays` and `deliveryMarkerDays` are positive whole-day windows, defaulting to 30,30,90. [Retention](retention.md) explains protected work, current ownership markers and explicit preview/apply. The bounded [business report](observability.md#query-retained-business-results) describes its actual retained cohort; it cannot recover expired historical details. `telemetryPricing` is optional, versioned and explicitly partial; omit it to report unavailable costs.

Customization prompt:

> Adapt [policy, research budget, retention or port] using the existing typed configuration. Keep deterministic bounds in schemas and capture immutable qualification settings per cycle. Preserve prior results, shared resource accounting, human routing for unresolved decisive facts and report missing-data semantics. Add observable isolated examples, freeze evaluation labels before measuring, and update the affected product guide.
