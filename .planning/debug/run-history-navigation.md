---
status: diagnosed
trigger: "UAT Test 8 - Run row click only toggles checkbox, doesn't navigate"
created: 2026-01-26T00:00:00Z
updated: 2026-01-26T00:00:00Z
---

## Current Focus

hypothesis: Row onClick handler only calls toggleRunSelection, missing navigation logic
test: Read run-history.tsx implementation
expecting: Find missing navigate call for row clicks
next_action: Document findings

## Symptoms

expected: Clicking on a run row (not checkbox) navigates to /datasets/:id/runs/:runId
actual: Clicking on run row only toggles checkbox selection
errors: None - just wrong behavior
reproduction: Click any run row in Run History tab
started: Initial implementation - never had navigation

## Eliminated

(none - first investigation)

## Evidence

- timestamp: 2026-01-26T00:00:00Z
  checked: run-history.tsx lines 121-146
  found: Row onClick={() => toggleRunSelection(run.id)} - only toggles selection
  implication: No navigation handler exists for row clicks

- timestamp: 2026-01-26T00:00:00Z
  checked: run-history.tsx line 51
  found: navigate function imported from useLinkComponent but only used for compare
  implication: Navigation infrastructure exists but not wired to row clicks

## Resolution

root_cause: |
RunHistory component Row onClick handler (line 125) only calls toggleRunSelection().
No navigation logic exists - clicking row should navigate to run details, but
current design assumes row clicks are only for comparison selection.

fix: (not applied - diagnosis only)
verification: (pending)
files_changed: []
