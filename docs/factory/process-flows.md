# Process Flows — Mastra Software Factory

## 1. GitHub issue → Work board lifecycle

```
GitHub issueOpened
      │
      ▼
Work item created (Intake, kind=resting)
      │  onEnter.issue: onArrival(triageIssueEntry)
      │  fires only if cause=linked_item_materialized AND metadata.autoStartCandidate=true
      ▼
Triage (working, role=triage)
      │  needsApproval(item)? ──yes──▶ prepareApproval (summarize decision needed)
      │         │no
      │         ▼
      │  invokeIssueInvestigation → factory-triage skill
      │  (human or rule) transitions on outcome
      ▼
Planning (working, role=plan)
      │  planWorkItem → factory-plan skill
      │  submit_plan tool result → advanceApprovedPlan (tool-result rule)
      ▼
Execute (working, role=work)
      │  buildWorkItem → implement approved plan / investigate+fix+test, open PR
      ▼
Review (working, role=work — same builder seat answers review feedback)
      ▼
Done (terminal) ──onEnter.issue: completeIssue (factory-complete-issue skill)
      │
      └── any phase ──▶ Canceled (terminal) on a cancel outcome
```

Every arrow is a **transition** gated by Work's `transitionPolicy`: classification required, non-bug items need a human transition or acceptance, and repeated/stale/timeout/causal-depth-exceeded transitions are rejected outright.

## 2. GitHub PR → Review board lifecycle

```
GitHub pullRequestOpened
      │
      ▼
Work item created (Intake, kind=resting)
      │  onEnter.pullRequest: reviewPullRequestOnArrival
      │  fires only if cause=linked_item_materialized AND autoStartCandidate=true
      ▼
Review (working, role=review)
      │  reviewPullRequest():
      │    fromStage === 'done'   → factory-rereview (supersedes prior pass? no — done has no live session)
      │    fromStage === 'review' → cancelInFlight: true (Review→Review re-entry supersedes)
      │    otherwise              → factory-review
      │  checkoutHint() ensures the session branch matches the current PR head
      │  outcomes: parked → Intake, merged → Done, closed → Canceled
      ▼
Done (terminal) ──outcome "updated" ──▶ back to Review (re-review path)
Canceled (terminal) ──outcome "reviewRequested" ──▶ back to Review
```

## 3. Linear issue → Work board (no auto-start on arrival)

```
Linear issueObserved
      │
      ▼
Work item created/updated (Intake)
      │  (no onEnter rule for linearIssue on Intake — never auto-starts)
      ▼
Triage (working, role=triage)
      │  onEnter.linearIssue: investigateTriagedLinearIssue
      │  → factory-triage skill, seeded with the Linear-fetch hint
      ▼
Planning → Execute → Review → Done  (same as GitHub issue flow from here)
```

## 4. Rule evaluation / dispatch flow (any board)

```
Ingress event (webhook delivery, tool result, or human transition request)
      │
      ▼
Resolve board for work item → resolve phase semantics (kind/role) for from/to phase
      │
      ▼
Board transitionPolicy(context) ──reject──▶ commit rejected outcome (code+reason), stop
      │ allow / undefined
      ▼
Board onEnter/onExit rule for (phase, source) ──▶ decision (invokeSkill | notify | reject | undefined)
      │
      ▼
Commit rule evaluation: configVersion, causalChain, outcome — idempotent per ingress identity
      │
      ▼
invokeSkill decision ──▶ Dispatcher claims lease → starts/resumes agent run seated in `role`
      │
      ▼
Agent run produces a tool result / ends ──▶ tool-result rule (e.g. submit_plan → advanceApprovedPlan)
      │                                      or reconcile sweep picks up a missed result
      ▼
Work item stage updated, stageHistory appended, sessions map updated
```

## 5. Factory documents sync (session materialization)

```
Session sandbox materializes on the project's repository
      │
      ▼
Read docs/factory/manifest.yaml (git show) ──missing/invalid──▶ fall back to catalog default paths + warning
      │ ok
      ▼
For each of the 15 catalog kinds: git show <resolved path> at the checkout's ref
      │
      ▼
Upsert factory_documents: title, summary, contentHash, sizeBytes, body, sourceRef, sourceSha, syncedAt
      │
      ▼
Documents page renders catalog (present/missing/oversize per kind); agent kickoff/prompt context includes synced docs
```
