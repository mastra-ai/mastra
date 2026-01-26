# Debug: Scores Not Displaying in Run Results

## ROOT CAUSE FOUND

**Root Cause:** Scores are never fetched - the page passes an empty object `{}` as scores

**Evidence:**
- Line 83-84 in `packages/playground/src/pages/datasets/dataset/run/index.tsx`:
  ```typescript
  // Placeholder for scores - in real implementation, fetch from scores endpoint
  const scores: Record<string, []> = {};
  ```
- API has `client.listScoresByRunId({ runId })` method available
- UI component `ResultsTable` expects `scores: Record<string, ScoreData[]>` keyed by itemId
- No hook exists in playground-ui to fetch scores for a run

---

## FILES INVOLVED

| File | Issue |
|------|-------|
| `packages/playground/src/pages/datasets/dataset/run/index.tsx:83-84` | Hardcoded empty scores object |
| `packages/playground-ui/src/domains/datasets/hooks/use-dataset-runs.ts` | Missing `useDatasetRunScores` hook |
| `packages/playground-ui/src/domains/datasets/components/results/results-table.tsx:97` | Expects scores keyed by itemId |

---

## DATA FLOW GAP

```
Current:
  useDatasetRunResults(runId) -> results
  scores = {}  <-- HARDCODED EMPTY

Expected:
  useDatasetRunResults(runId) -> results
  useScoresByRunId(runId) -> scores[] -> transform to Record<itemId, ScoreData[]>
```

---

## API AVAILABLE

- `client.listScoresByRunId({ runId })` returns `{ scores: ScoreRowData[], pagination }`
- ScoreRowData has `entityId` (itemId), `scorerId`, `score`, etc.
- Need to group scores by `entityId` to match UI expectation

---

## SUGGESTED FIX DIRECTION

1. Add `useScoresByRunId` hook in `packages/playground-ui/src/domains/datasets/hooks/`
2. Transform flat scores array to `Record<itemId, ScoreData[]>` format
3. Use hook in `packages/playground/src/pages/datasets/dataset/run/index.tsx`
4. Pass transformed scores to `ResultsTable`

---

## COMPLEXITY: Low

- Hook pattern exists for other score endpoints
- Transform is straightforward groupBy operation
- No API changes needed
