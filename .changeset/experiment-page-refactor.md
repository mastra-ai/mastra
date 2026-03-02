---
'@mastra/playground-ui': patch
'mastra': patch
---

Redesigned experiment detail page with tabbed layout, score integration, and modular column panels.

**Experiment page layout**

- Added `ExperimentPageContent` with Summary and Results tabs, replacing the old `ExperimentResultsListAndDetails` component
- Summary tab shows `ExperimentScorerSummary` with per-scorer average scores
- Results tab displays a master-detail column layout with score columns in the results list

**Score detail panel**

- Added `ExperimentScorePanel` that opens as a column when clicking a score row in the result detail panel
- Shows score value, reason, input/output, and LLM prompts (preprocess, analyze, generate score, generate reason)
- Score and trace panels are mutually exclusive — opening one closes the other
- Prev/next navigation between scores within a result

**Score data improvements**

- `useScoresByExperimentId` now preserves full `ClientScoreRowData` instead of a minimal subset
- Added `perPage: 10000` to `listScoresByRunId` to prevent score truncation from server default limit

**Component cleanup**

- Removed `ListAndDetails` DS component — replaced by `Column` sub-components (`Column.Toolbar`, `Column.Content`)
- Extracted `MultiColumn` component for managing horizontally scrolling multi-column layouts
- Deleted `ExperimentResultsListAndDetails` (superseded by `ExperimentPageContent`)
