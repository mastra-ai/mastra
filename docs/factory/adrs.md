# Architecture Decision Records — Mastra Software Factory

Format: lightweight ADRs reconstructed from the codebase's committed design (README, CHANGELOG, source comments) rather than a separate ADR log. Each entry states the decision, why, and what it replaced.

## ADR-1: Boards own their entire lifecycle — no global `rules` object

**Decision.** Every lifecycle rule (`onEnter`/`onExit`), transition policy, and tool-result rule is declared on the board it belongs to via `defineBoard()`. There is no `rules.work` / `rules.review` global configuration object, and the runtime never falls back to Work's behavior for another board.

**Why.** A prior design let a single global `rules` config apply across boards by name-matching phases, which meant installing a custom board could silently inherit or collide with Work's semantics. Making each board self-contained means an unknown board or phase fails closed (no seat started, nothing auto-cleaned) instead of guessing.

**Consequence.** Integrations similarly own their own event handlers (e.g. `PlatformGithubIntegration`'s `rules` constructor option) instead of registering into a shared dispatch table.

## ADR-2: Every board phase declares an explicit `kind`

**Decision.** `defineBoard()` requires every phase to declare `kind: 'resting' | 'working' | 'terminal'`; a `working` phase must declare a `role`; a `terminal` phase must not. `initialPhase` must reference a resting phase. This is validated at `defineBoard()` call time (`BoardDefinitionError`), not discovered at runtime.

**Why.** Runtime code (consent arming, the external-author guard, kickoff seating, run-start lane selection, terminal cleanup, closed-PR/issue sweeps, supervisor findings) previously matched built-in phase names to infer semantics. That meant a custom board's phases were invisible to those systems unless they happened to reuse Work's names. Declaring `kind`/`role` on the phase itself lets every system read semantics from the installed board definition generically.

**Consequence.** Existing `defineBoard()` calls from before this change require a one-time migration adding `kind` (and `role` for working phases) to every phase.

## ADR-3: Board catalog is served to the UI as data, not code

**Decision.** `GET /web/factory/projects/:id/boards` serializes each installed board's phase topology (ids, titles, kind, role, transitions) — handlers, transition policies, and prompts are never serialized. The Factory UI renders board columns, phase labels, and available card moves entirely from this catalog rather than hardcoding Work/Review-specific UI.

**Why.** Custom boards needed to be first-class in the UI without a UI code change per board. Serializing only the safe, declarative subset of a board definition avoids leaking handler closures or prompts to the client while still letting the UI stay generic.

**Consequence.** A card's persisted `board` field determines its membership; the UI cannot reassign a card to a different board — that requires an explicit intake-routing change (label route or Linear-project binding).

## ADR-4: Intake→board routing is explicit, not implicit from "opening" a board

**Decision.** A Linear project or GitHub repository feeds a specific board only once explicitly bound to it (`intake_source_bindings.board`); GitHub additionally supports per-label routing (`intake_label_routes`) so an issue's label picks its board. Merely viewing/opening a board in the UI never materializes cards into it.

**Why.** Implicit routing (e.g. "whatever board is open gets new cards") is surprising and non-reproducible from the config a maintainer set up. Explicit bindings make intake routing auditable and independent of UI navigation.

## ADR-5: One storage backend, many domain-scoped classes

**Decision.** A single `FactoryStorage` connection (Postgres or LibSQL) backs both the shared agent runtime and every Factory-specific concern, but each concern (`work-items`, `projects`, `documents`, `audit`, `intake`, `comments`, `channel-identity`, etc.) is its own `FactoryStorageDomain` subclass with its own `CollectionSchema`.

**Why.** A deployment should only need to configure one database connection to get every Factory feature (avoids N connection strings for N features), while keeping each domain's schema, migration, and query surface independently ownable and testable.

**Consequence.** Cross-domain consistency (e.g. `work_items.comment_count` denormalized from the comments domain) is maintained by explicit recount/update calls between domains rather than database-level foreign keys or triggers.

## ADR-6: `configVersion` replaces `ruleSetVersion` as pure provenance

**Decision.** Contexts and audit rows carry an operator-maintained `configVersion` string (default `factory-config-v1`), stamped everywhere a rule decision or session kickoff is recorded. It is descriptive only — no code branches on its value, and Work's `submit_plan` rule cannot be overridden by configuration.

**Why.** An earlier `ruleSetVersion` concept implied config-driven rule selection; the simpler contract is that code fully determines behavior, and the version label exists only so an operator can correlate a row with the deployed code that produced it.

## ADR-7: Integrations are instances the host constructs, not env-var-reading singletons

**Decision.** `FactoryIntegration` is a contract; the host's deploy entry reads that integration's env vars once, constructs an explicit instance, and passes it via `MastraFactoryConfig.integrations`. No system code reads integration env vars directly or imports integration free functions — everything downstream talks to the instance through `IntegrationContext`.

**Why.** Centralizing credential reads in the entry file keeps them out of library code and makes an absent integration a clean no-op (routes don't mount, tools don't register, diagnostics say "not configured") rather than a runtime error deep in shared code. It also makes third-party integrations possible without factory code changes — implement the same interface.

## ADR-8: Factory documents are synced snapshots, repo is source of truth

**Decision.** The 14-kind document catalog (`FACTORY_DOC_KINDS`) is hardcoded; only the mapped path per kind is configurable via `docs/factory/manifest.yaml`. The `factory_documents` table holds the last synced snapshot (title/summary/hash/body) so the UI and agent kickoff never need a live checkout to read a document, and a document the repo lacks is stored as `status: 'missing'` rather than omitted, so the gap is visible everywhere.

**Why.** Keeping the catalog fixed avoids per-deployment schema drift in what "the project's essential documents" means, while the manifest gives each repo flexibility in *where* those documents live. Storing missing docs explicitly (not as an absent row) makes "nothing written yet" a first-class, visible state instead of silence.
