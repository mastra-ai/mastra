# Glossary — Mastra Software Factory

**Board** — A named lifecycle graph of phases and transitions, defined via `defineBoard()`. Work and Review are built in and installed automatically unless `includeDefaultBoards: false`. Custom boards are passed via `MastraFactoryConfig.boards`. Board IDs `work` and `review` are reserved.

**Phase** — One node in a board's graph. Every phase declares a `kind`: `resting` (idle, no agent seated — e.g. Intake, Done, Canceled), `working` (an agent role is seated — requires `role`), or `terminal` (no `role` allowed). `initialPhase` must be a resting phase.

**Role** — The agent seat a working phase names: `triage`, `plan`, `work`, or `review` (`FACTORY_ROLE_STAGES`, mapped 1:1 to the stages `triage`, `planning`, `execute`, `review`).

**Work item** — The persisted card (`WorkItemRow`). Belongs to one Factory project, carries `stages` (current stage path), `stageHistory`, `sessions` (per-role bound agent sessions), `metadata`, `triageType`, and timestamps like `acceptedAt`/`autonomyArmedAt`/`plansPreapprovedAt` that gate autonomous behavior.

**External source** (`ExternalWorkItemSource`) — Provider-neutral pointer (`integrationId`, `type`, `externalId`, optional `workspaceId`/`url`) linking a work item to its GitHub issue/PR or Linear issue. Absent for manually created items.

**Transition** — A move from one phase to another, driven by a source (`issue`, `pullRequest`, `linearIssue`, `manual`), an outcome name, and an actor. Subject to the board's `transitionPolicy`.

**Transition policy** (`BoardTransitionPolicy`) — Board-owned function that allows or rejects a transition beyond basic topology, e.g. Work's classification, human-approval, and acceptance gates. Returns `{ type: 'allow', ... }`, `{ type: 'reject', code, reason }`, or `undefined` (no opinion).

**Rule** — A handler a board attaches to a phase's `onEnter`/`onExit` (keyed by source) or to a tool's result (`tools.<name>.onResult`). Rules return a typed decision or `undefined`; the runtime executes exactly what boards declare — there is no global rules object.

**Ingress** — One inbound event that can trigger rule evaluation: a GitHub webhook delivery, a Linear event, a tool result, or a human action. Committed rule evaluations are keyed by ingress identity for idempotency/replay.

**Causal chain** — The ordered list of `{ ingressId, decisionType }` entries a rule evaluation was derived from, capped at `MAX_FACTORY_RULE_CAUSAL_DEPTH`, so a decision can be traced back through the events that produced it.

**`configVersion`** — Operator-maintained provenance label (default `factory-config-v1`) stamped on audit rows, deferred decisions, and session kickoff headers. Purely informational — nothing branches on its value.

**Autonomy gates** — `acceptedAt` (a human moved the item out of Intake/Triage), `autonomyArmedAt` (a human first committed the item to running), `plansPreapprovedAt` (a human granted hands-off plan approval for this item specifically). Distinct from the project-level `autoRunEnabled`/`autoApprovePlans` switches.

**`autoStartCandidate`** — Metadata flag stamped by an integration (e.g. GitHub, from actor trust + issue timing) marking an item eligible for automatic first-pass investigation on `linked_item_materialized`. Manual entry and non-candidate arrivals never auto-start.

**Dispatcher** — The background poller (`rules/dispatcher.ts`) that claims leased work, starts/resumes agent runs for a seated role, watches them to completion, and reconciles missed results. Bounded by `MAX_IN_FLIGHT`, retried up to `MAX_ATTEMPTS` with backoff, terminal failures surfaced rather than retried forever.

**Skill invocation** — A rule's `invokeSkill` effect (e.g. `factory-triage`, `factory-plan`, `factory-review`) that starts or resumes an agent run seated in a given role with a prompt or named skill and an idempotency key.

**Factory documents** — The fixed 14-kind catalog of markdown files under `docs/factory/`, synced from the repository via `manifest.yaml` on session materialization, surfaced to agents at kickoff and to humans via the Documents page.

**`FactoryStorage`**, **`MastraFactory`**, **`FactoryIntegration`** — see `architecture.md`.
