# Learnings - resourceid-selection

## Session: ses_3c7b6552fffephxzflmAbkYmms

Started: 2026-02-07T13:50:44.010Z

---

## Session: Current

Date: 2026-02-07

### selectedResourceId Implementation

- Added `selectedResourceId` state to `Agent` page.
- Used `localStorage` for persistence: `mastra-agent-resource-${agentId}`.
- Handled state initialization on `agentId` change: checks localStorage, fallback to `agentId`.
- Added `handleResourceIdChange` to update state, localStorage, and navigate.
- Verified with `tsc --noEmit`.
