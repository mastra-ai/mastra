# Business Rules — Mastra Software Factory

Source: `src/rules/types.ts`, `src/boards/*.ts`, `src/boards/work-transition-policy.ts`, `src/storage/domains/work-items/base.ts`.

## Autonomy and approval gates

1. **Non-bug human-approval gate (Work board).** A work item classified as anything other than `bug` must have a human transition (`isHumanTransition`) recorded, or an explicit acceptance, before it can move through Planning/Execute unattended. Work's `transitionPolicy` (`work-transition-policy.ts`) enforces classification requirement, the non-bug approval gate, and the acceptance decision on every transition; no other board inherits this by name-matching — each board's policy is evaluated independently.
2. **Needs-approval label holds a card at rest.** `needsApproval(item)` is true only while the item carries the `status: needs approval` label (case-insensitive), has no `acceptedAt`, and its current stage path is entirely within `intake`/`triage`. Once accepted or moved past triage, the label is considered stale until the source catches up — it no longer blocks.
3. **Externally-authored items fail closed.** `externallyAuthored(item)` is true for any `github-pr`/`github-issue` item unless `metadata.factoryAuthored === true` or `metadata.authorTrusted === true`. A missing trust stamp (not yet reconciled) is treated as untrusted, not as trusted-by-default.
4. **`knownExternalAuthor`** additionally requires GitHub to have explicitly answered `authorTrusted: false` — it does not fire on a merely-missing stamp, only a confirmed outside contribution.
5. **Autonomy timestamps are one-way and additive.** `acceptedAt`, `autonomyArmedAt`, and `plansPreapprovedAt` are each stamped once by a human action and never cleared; a second grant of the same kind is a no-op (`plansPreapproved?: true` in `UpdateWorkItemInput` only ever sets it).
6. **Project-level switches widen but never replace item-level gates.** `autoRunEnabled` lets rules start runs without a human's per-run approval; `autoApprovePlans` lets the dispatcher answer a `submit_plan` result itself. Both are project settings (`FactoryProject`), independent of any single item's `acceptedAt`/`plansPreapprovedAt`.

## Intake and auto-start

7. **Auto-start requires both a qualifying cause and a stamped candidate flag.** A phase's arrival rule only fires when `context.cause === 'linked_item_materialized'` AND `context.item.metadata.autoStartCandidate === true` (see `onArrival()` in `work.ts`, `reviewPullRequestOnArrival()` in `review.ts`). Manual card creation and non-candidate arrivals never auto-start investigation just by landing in Intake.
8. **GitHub stamps `autoStartCandidate`** using actor trust and issue-creation timing; Linear intake does not automatically investigate on arrival — entering Triage invokes the existing investigation behavior instead.
9. **Work board's Triage entry chooses the seat by approval state:** `needsApproval(item)` true → `prepareApproval` (asks the triage seat to summarize the decision needed, does not investigate); otherwise → `invokeIssueInvestigation` (runs `factory-triage`).

## Board topology invariants (enforced by `defineBoard`)

10. Every phase must declare a `kind` of `resting`, `working`, or `terminal`; a `working` phase must declare a `role`; a `terminal` phase must NOT declare a `role`.
11. `initialPhase` must reference a phase whose `kind` is `resting`.
12. Board IDs `work` and `review` are reserved — a custom board cannot claim either.
13. Rule handlers (`onEnter`/`onExit`/tool-result) return one typed decision object or `undefined`; returning anything else is a definition error caught at `defineBoard()` time, not at runtime.

## Review board specifics

14. **Re-review vs. first review.** `reviewPullRequest()` selects `factory-rereview` when `context.fromStage === 'done'` (a prior review pass actually completed) and `factory-review` otherwise — including a card that cancels out of Review and re-enters Review directly, which has no prior pass to reconcile.
15. **In-flight cancellation only on Review→Review re-entry.** `cancelInFlight: true` is only set when `context.fromStage === 'review'`; a card returning from Done has no live review session to supersede, so re-arming it must not cancel the fresh re-review kickoff.
16. **Session freshness for checkout.** The review seat's checkout hint always tells the agent to verify `gh pr view <n> --json headRefOid` against `git rev-parse HEAD` and refresh via a filtered fetch + `checkout -B` if they differ, because a reused session's branch may point at a stale PR head.

## Governance

17. **No global rules object.** Every lifecycle rule, transition policy, and tool-result rule has exactly one owner: the board that declares it. Integrations own their own event handlers (e.g. `PlatformGithubIntegration`'s `rules.issueOpened`). The runtime only executes what is declared — there is no fallback to Work's behavior for another board.
18. **`configVersion` is provenance only.** It is stamped everywhere a decision is recorded but never changes which rule fires or how a decision is evaluated.
