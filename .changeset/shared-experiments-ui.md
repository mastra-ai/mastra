---
'@mastra/playground-ui': minor
---

Studio's experiments UI now ships from `@mastra/playground-ui/domains/experiments`, so another app can render its own experiments list, experiment page and comparison. No part fetches: experiments, results, scores and usage come in as props typed with the `@mastra/client-js` and `@mastra/react` response types, and actions (delete, rename, request review, add a tag, open an item) go out through callbacks. The parts render without a Mastra client, React Query or a router; links use `useLinkComponent()` paths (`experimentLink`, `experimentItemLink`, `datasetLink`, `traceLink`).

Call the `@mastra/react` hooks yourself and pass the data down. An action you leave out hides its control: without `onDeleteExperiment` the list has no delete buttons, without `onRename` the header has no rename item, and without a `tracePanel` slot nothing links to a trace.

```tsx
import {
  ExperimentItemPanel,
  ExperimentItemPanelProvider,
  ExperimentKpis,
  ExperimentResultsSection,
  ExperimentsList,
  useResultsSelection,
} from '@mastra/playground-ui/domains/experiments';

<ExperimentsList
  experiments={experiments}
  isLoading={isLoading}
  onDeleteExperiment={id => deleteExperiment.mutateAsync(id)}
/>;

const selection = useResultsSelection(results);

<ExperimentItemPanelProvider
  experimentId={experiment.id}
  datasetId={experiment.datasetId}
  results={results}
  isLoadingResults={isLoading}
  currentItemId={itemId}
  onOpenItem={openItem}
  onClose={closeItem}
>
  <ExperimentKpis experiment={experiment} scoresByItemId={scores} usage={usage?.summary} />
  <ExperimentResultsSection
    results={results}
    isLoading={isLoading}
    scoresByItemId={scores}
    selectedIds={selection.selectedIds}
    onToggleSelect={selection.toggleSelect}
    onToggleSelectAll={selection.toggleSelectAll}
  />
  <ExperimentItemPanel
    scoresByItemId={scores}
    onFlagForReview={resultId => flagForReview(resultId)}
    tracePanel={state => (
      <MyTracePanel traceId={state.featuredTraceId} onClose={() => state.setFeaturedTraceId(undefined)} />
    )}
  />
</ExperimentItemPanelProvider>;
```

**Added**

- Experiments list: `ExperimentsList`, `ExperimentRowCells`, `ExperimentsToolbar`, `ExperimentsFilterBar`, `ExperimentsBulkActions`, `ExperimentsComparableLegend`, `DeleteExperimentsButton`, `DeleteExperimentDialog`, `NoExperimentsInfo` and the name labels. Target names resolve through an optional `targetRegistries` prop and fall back to the target id. The toolbar and filter bar take their `Target type` / `Target` fields as a `targetFields` prop: build them with `useTargetFilterFields(targetType)` from `@mastra/playground-ui/domains/datasets`, or pass `[]` to hide the target filter.
- Experiment page: `ExperimentPageLayout` (breadcrumbs and the actions menu over the page body) and `ExperimentBreadcrumbs` ("Experiments / name", with the run status and item count), `ExperimentHeaderActions` (with a `rerunSlot`), `RenameExperimentDialog`, `ExperimentKpis`, `ExperimentRunProgress`, `ExperimentResultsSection`, `ExperimentResultsList`, `ExperimentResultsBulkActions`, `ExperimentResultsTagPicker`, `ExperimentItemPanelProvider` (router-agnostic: the open item and its open/close callbacks come in as props), `ExperimentItemPanel`, `ExperimentResultDetail`, `ExperimentResultPanel`, `ExperimentScorePanel`, `ToolMockReportSection`, and the `useResultsSelection`, `useExperimentResultDetailState` and `useNow` hooks.
- Comparison: `ExperimentsComparison` with `itemPanel` and `tracePanel` slots, `ComparisonSideTitle`, `ComparisonSideSummary`, `CompareMetricsMenu`, `ComparisonItemPanel`, `ComparisonSideCell` and `buildComparisonRows`.
- Helpers: `getExperimentDisplayName`, the result output helpers and the target name helpers.
