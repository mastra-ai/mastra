# Research sources

The default `openai-web` provider uses GPT-6 Luna Responses web search with domain filtering. URLs/citations discover possible sources; they do not prove a claim. The workflow retrieves bounded HTTPS source pages, records their actual text, then runs structured extraction and a separate semantic-support check. Accepted candidates must also quote an exact substring of retrieved material. The persisted summary cites the resulting evidence IDs.

Business-model classification may infer either an allowed positive or negative category from the captured classification criteria. A hosted API offering and a separate business-customer passage can jointly support B2B SaaS without that literal phrase. Affirmative physical-goods evidence can support `other`; missing information cannot. Adapt category labels, criteria and accepted labels together for another ICP. Search and both model passes receive those captured definitions; they do not retain a fixed B2B search target.

An inferred candidate keeps the main `evidenceId`/`quote`, a separate model-generated `inference.rationale`, and up to three `inference.additionalPassages`. Each passage must be a distinct, contiguous verbatim quote of at most 2000 characters from its named evidence excerpt. All citations must match exactly, and the independent verifier must find that the cited passages collectively establish the configured criteria. Uncited text and the rationale itself cannot substitute for supporting passages. Accepted inference provenance is persisted in `assessment.inferences`, with candidate IDs, classification, rationale and passage references; fact evidence references include every cited source. The summary identifies inference separately. False citations, unsupported inference and unconfigured labels remain unsupported/reviewable. Employee estimates use the same exact-passage and independent-verification contract, with `basis: inferred` and an employeeCount inference record. Employee estimates are advisory under the default `estimates: 'review'`; source-declared counts/ranges remain observed. Headquarters and intent remain explicit.

Only returned URLs on the company domain or configured additional domains can be retrieved. DNS results must be public, connections use validated addresses, and each redirect repeats URL/DNS validation and consumes another request. Credentials, private addresses and non-HTTPS URLs are rejected. No links are crawled and page JavaScript is not executed. Missing or conflicting material produces visible uncertainty.

Prerequisites: inspect `EvidenceProvider`/`ResearchContext` in `src/mastra/providers/evidence.ts`, `Evidence` in `research/contracts.ts`, the provider map, and persistent reservations. Default research needs only `OPENAI_API_KEY`.

## Add an approved domain

1. Establish which attributes the source substantiates. A directory with explicit dated workforce data can supplement a company site that omits headcount. Permission to retrieve is not a reliability guarantee.
2. Add the approved hostname, without scheme/path, to `qualificationConfig.sources.additionalDomains`. For a company directory, verify its actual provenance and access requirements before enabling it. Subdomains are included; lookalike suffixes are excluded.
3. Restart and submit a new event. Existing runs retain their captured source policy.
4. Check quotes, IDs, timestamps and digests in the read route. Conflicting decisive facts require review; source priority never silently resolves them.
5. Add controlled responses under `tests/` and run integration checks for attribution, conflicts, off-policy citations, timeout and shared exhaustion. Keep live checks separate.

## Add an evidence integration

An adapter implements `search`, `extract` and `verify`, then registers by ID in `evidenceProviders`. Search returns `{ sourceUrls, evidence }`: web discovery supplies URLs for shared page retrieval; an API/internal adapter can return normalized material directly. Direct evidence must pass the schema and digest check. Web references must match approved domains; non-web references must exactly match `sources.trustedReferences`. Evidence `providerId` must match its adapter.

Each discovery result may contain at most 100 URLs and 20 evidence items; each extraction may contain at most 30 candidates. Up to ten configured providers can contribute to a branch without losing valid facts, conflicts or rejection diagnostics. An invalid or oversized adapter result records an explicit provider-contract failure and preserves successful adapters. The summary cites one representative source per rule and reports additional evidence references; the assessment retains every source and fact reference.

Stored evidence IDs bind the provider, adapter record ID, source identity and content digest. Adapters keep their current material IDs during extraction/verification; accepted main and additional citations are remapped together to stable stored IDs. Identical normalized source/quote pairs are deduplicated while preserving the main quote and distinct additional passages; normalized candidates are schema-validated before acceptance. Prior-round sources are supplied under those stored IDs. Reusing a record ID across adapters or changed content therefore cannot overwrite earlier provenance. Conflicting duplicate IDs within one current material set are rejected explicitly as evidence_id_conflict before candidate acceptance.

1. Select the source and any optional credentials. Do not introduce requirements for users retaining the default provider.
2. Normalize references, retrieval/publication times, bounded passages and failures. Distinguish API passages from retrieved pages. Never generate a quote and label it as source text.
3. Reserve allowance before each external attempt using `context.store.reserve`. A source lookup consumes the shared discovery/search allowance, page GETs consume page allowance, and model output reserves tokens. Respect the absolute deadline and retry helper; preserve unknown reservations and settle only known measurements.
4. Delegate extraction/support verification to `OpenAIEvidenceProvider` when appropriate, or implement the same structured contracts. Extraction agents receive no browse or write tools.
5. Pass adapters through `createApplicationRuntime({ evidence: [...] })`, enable their IDs in `sources.providerIds`, and configure exact trusted references. Workflow and scoring need no provider-specific branches.
6. Test provenance, missing/conflicting/unsupported facts, unauthorized references, timeout, redelivery and shared exhaustion with controlled fixtures. Verify default local use still requires no optional provider key.

This composition uses the shipped interface. `loadApprovedMaterial` is your bounded transport for the selected integration; it returns normalized `Evidence[]` and must enforce its response size/deadline without following arbitrary event URLs.

```ts
const model = new OpenAIEvidenceProvider();
const internal: EvidenceProvider = {
  id: 'internal-records',
  async search(branch, context) {
    const reservation = await context.store.reserve(context.runId, 'search', 128);
    const evidence = await loadApprovedMaterial(branch, context);
    await context.store.settle(reservation, { outputTokens: 0 });
    return { sourceUrls: [], evidence };
  },
  extract: (branch, evidence, context) => model.extract(branch, evidence, context),
  verify: (branch, candidates, evidence, context) => model.verify(branch, candidates, evidence, context),
};
```

The minimum output reservation is 128 tokens. This non-model lookup releases that allowance only after known completion with zero model output; interruption retains it conservatively. Different accounting semantics require an explicit contract extension and functional tests. New transports must not bypass shared budgets or multiply allowance by source count.

Customization prompt:

> Extend this Lead Qualification template with [source] for [attributes]. Inspect EvidenceProvider, its registry, source settings and persistent budgets. For another approved domain, change configuration only. Otherwise add one optional adapter with real bounded passages, source references, retrieval times, digests and normalized failures. Share search, GET, byte, token and absolute-time limits across sources/retries. Preserve DNS/redirect validation, exact attribution, semantic support, conflicts, deterministic scoring and production authentication. Keep fixtures/tests under tests/ and operational scripts under scripts/. Add functional attribution, unauthorized-source, conflict, timeout and exhaustion checks. Update this guide and keep default local use dependent only on OPENAI_API_KEY.

## Target missing qualification data

The captured `research.targeted` plan researches model/product evidence, workforce and headquarters, then repeats workforce if unresolved. Edit the ordered targets and query instructions for another ICP. Search receives the actual round target, current facts, unresolved attributes, sanitized consulted URLs and bounded earlier public source context; the year comes from captured assessmentTime. It seeks complementary evidence rather than repeating a generic query. Only actual returned approved URLs can be retrieved, at most one useful page per round. Earlier authorized material is reused for extraction and verification when discovery returns no new usable page.

Completed round checkpoints retain material, proposals, rejections and small diagnostics. Restart reuses them; interrupted unknown calls retain reservations. URL outcomes contain no query, fragment or credentials; gap codes distinguish unresolved/rejected/conflicting/stale evidence, lower-only counts, unavailable material and budget exhaustion. `no_count_observed` means extraction obtained no supported count from the inspected material, not that the company publishes no count anywhere. Logs omit excerpts, quotes and inference rationale.

Extraction and verification receive current versus previous evidence IDs, target, missing attributes and supported facts. They prioritize the unresolved target while retaining useful incidental support and genuine contradictions. Accepted intervals crossing an ICP boundary remain eligible for follow-up. Rejected restatements cannot poison independent supported firmographics; disjoint ranges and other contradictory values still require review. Compatible employee ranges are intersected with all provenance retained; inferred narrowing remains labeled inferred. Buying-intent rejection/coverage safeguards remain strict. Lower-only employee observations retain max null. A finite employee estimate needs concrete cited workforce support for both bounds, never an invented maximum derived from the ICP. Submitted inquiry evidence is considered first; the default plan performs no public intent search.
