# User Stories & Acceptance Criteria — Mastra Software Factory

## Intake

**US-1: As a maintainer, when a contributor opens a GitHub issue on a connected repo, I want it to appear on the Work board without manual entry.**
- Given a repository with an installed GitHub integration, when `issueOpened` fires, then a work item is created (or matched by `source_key`) in the Work board's Intake phase with `externalSource` populated.
- The item's `autoStartCandidate` metadata is stamped from actor trust and issue timing.
- If `autoStartCandidate` is true, Intake's `onEnter.issue` rule fires `triageIssueEntry` automatically; otherwise the card waits in Intake for a human transition.

**US-2: As a maintainer, when a PR is opened against a connected repo, I want it to appear on the Review board.**
- Given the GitHub integration is installed, when a PR is opened, a work item is created on the Review board's Intake phase with `externalSource.type = 'pull-request'`.
- If `autoStartCandidate` is true, `reviewPullRequestOnArrival` invokes `factory-review` automatically.

**US-3: As a maintainer, I want a Linear issue in a bound project to become a work item.**
- Given a Linear project is bound to a board, `issueObserved` creates/updates the corresponding work item; entering Triage invokes `factory-triage` with the Linear fetch hint — Linear issues do not auto-start purely on arrival.

**US-4: As a maintainer, I want to create a work item manually for something with no external source.**
- A manually created item has `externalSource: null` and `source: 'manual'`; it never auto-starts on arrival, and its `sourceRef()` renders as its title or URL rather than a "GitHub issue #n" style reference.

## Triage, approval, and planning

**US-5: As a maintainer, I want an issue labeled "status: needs approval" to stop for my decision instead of being auto-investigated.**
- Given the item carries the label, has no `acceptedAt`, and its stage path is within `intake`/`triage`, entering Triage produces a `prepareApproval` invocation (summarize the decision needed), not `invokeIssueInvestigation`.
- Once I (a human) transition it or it gains `acceptedAt`, the label no longer blocks subsequent phases.

**US-6: As a maintainer, I want non-bug items to wait for my explicit go-ahead before Planning/Execute proceed unattended.**
- Given the triage seat classifies an item as anything other than `bug`, the Work transition policy requires a human transition or acceptance before further autonomous progression; a rejected transition surfaces a `reason` and `code` (e.g. `approval_required`) to the UI.

**US-7: As a contributor, I want to approve a plan and have the item automatically move into Execute.**
- Given the plan seat calls `submit_plan` with an approved plan, the `submit_plan` tool-result rule (`advanceApprovedPlan`) transitions the item from Planning to Execute without an extra manual step, up to `MAX_PLAN_APPROVALS` re-plan cycles before requiring a person.

## Building and review

**US-8: As a contributor, I want the build seat to open a PR when the fix is ready.**
- Given the item enters Execute, `buildWorkItem` invokes the `work` role with a prompt to implement (from an approved plan, or investigate+fix+test when there was no planning stage) and open a PR when ready.

**US-9: As a maintainer, I want my PR's review pass to run automatically only when it was flagged eligible.**
- Given `autoStartCandidate` is true, review runs automatically on arrival; otherwise the card sits in Review's Intake until a human moves it.

**US-10: As a maintainer, when I push more commits after a review completed, I want a re-review that reconciles the earlier verdict.**
- Given the card returns to Review from Done, `factory-rereview` runs instead of `factory-review`, reconciling prior findings against new commits.

## Documents

**US-11: As a maintainer, I want the agent to read the same product/technical documents I maintain in the repo.**
- Given `docs/factory/manifest.yaml` maps a catalog kind to a path, session materialization syncs that document's title/summary/hash/body from the checkout into the `factory_documents` domain, and kickoff/prompt context includes it.
- Given a kind has no manifest entry or an invalid manifest, the sync falls back to the kind's default path and records a warning rather than failing the sync.

**US-12: As a maintainer, I want to see which documents are missing so I know what to write.**
- The Documents page renders one row per catalog kind, grouped `ba`/`tech`; a kind with no file at its resolved path shows `status: missing` with the expected path and a note that it can be created.

## Governance / operators

**US-13: As an operator, I want every transition decision traceable to the deployment and code that made it.**
- Every committed rule evaluation stores `configVersion`, the `causalChain`, `outcome` (`accepted`/`rejected` with `code`/`reason` on rejection), and is idempotent per `ingress` identity (a replayed webhook delivery reuses the prior committed result rather than re-deciding).

**US-14: As an operator, I want to define a custom board for a workflow Work/Review don't fit (e.g. release).**
- Given I call `defineBoard({ id: 'release', ... })` and pass it in `boards: [...]`, the board is installed, validated (every phase has a `kind`, working phases have a `role`, `initialPhase` is resting), and its lifecycle/tool-result rules run independently of Work/Review.
