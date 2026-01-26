---
status: diagnosed
phase: 06-playground-integration
source: [06-11-SUMMARY.md]
started: 2026-01-26T23:30:00Z
updated: 2026-01-26T23:45:00Z
---

## Current Test

[testing complete]

## Tests

### 4. Results Auto-Refresh (retest)
expected: Results table auto-updates every 2 seconds while run is in progress
result: pass

### 5. Scores Display (retest)
expected: Run results view shows scores for each item with scorer names and values
result: issue
reported: "Scores returned from API but not linked to result items. entityId is targetId (agent/workflow), not itemId."
severity: major

### 6. Trace Links (retest)
expected: Result detail dialog shows View Trace link that navigates to /traces/:traceId
result: pass
note: "Link works but traces page shows nothing. User requests inline trace panel instead."

## Summary

total: 3
passed: 2
issues: 1
pending: 0
skipped: 0

## Diagnosed Issues

1. **Scores not linked to results** — entityId mismatch and architectural gap

## Gaps

- truth: "Scores display in results view with scorer names and values"
  status: failed
  reason: "Scores stored with entityId=targetId, UI expects entityId=itemId"
  severity: major
  test: 5
  root_cause: "Architectural mismatch - scores stored separately in ScoresStorage with entityId pointing to agent/workflow, not the dataset item. UI tries to join by itemId but finds no matches."
  artifacts:
    - path: "packages/core/src/datasets/run/scorer.ts"
      issue: "Line 65: entityId: targetId - stores agent/workflow ID, not item ID"
    - path: "packages/playground-ui/src/domains/datasets/hooks/use-dataset-runs.ts"
      issue: "useScoresByRunId groups by entityId expecting itemId"
  missing:
    - "Embed scores directly in RunResult type"
    - "Store scores with result during run execution"
    - "Add scores to runResultResponseSchema"
    - "Remove separate useScoresByRunId approach"
  debug_session: ""

- truth: "Trace page displays trace data"
  status: failed
  reason: "Traces page exists but shows nothing"
  severity: minor
  test: 6
  root_cause: "Traces page route exists but implementation incomplete or missing data fetch"
  artifacts:
    - path: "packages/playground/src/pages/traces/index.tsx"
      issue: "Page may not fetch/display trace data"
  missing:
    - "Implement trace detail page or inline panel"
  debug_session: ""

## UX Feedback

- User prefers inline trace panel over navigation to separate page
