import { useState } from 'react';

import { EXAMPLES_PAGE_SIZE, ExamplesPager } from './examples-pager';
import { useThemeDetail, useThemeExamples, useThemeHistory } from './hooks';
import { getSignalHue } from './signal-colors';
import { formatSnapshotDate, shareSentence, signalDescription, signalLabel } from './signal-formatting';
import type { SelectedTheme, ThemeSelection, ThemeSelectionStats } from './theme-drilldown-data';
import { chronologicalHistoryPoints, themeTrendDirection } from './theme-trend';
import { ThemeTrendChart } from './theme-trend-chart';
import { TraceInsightView } from './trace-insight-view';
import { useTraceIntelligence } from './use-trace-intelligence';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/ds/components/Drawer';
import { nodeColor } from '@/ds/components/SankeyChart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

interface ThemeDetailPanelProps {
  entityId: string;
  entityType: string;
  snapshotId: string;
  snapshotTotal: number;
  selection: SelectedTheme | undefined;
  filters?: ThemeSelection[];
  filteredStats?: ThemeSelectionStats;
  onClose: () => void;
}

export function ThemeDetailPanel({
  entityId,
  entityType,
  snapshotId,
  snapshotTotal,
  selection,
  filters = [],
  filteredStats,
  onClose,
}: ThemeDetailPanelProps) {
  const { signalCatalog } = useTraceIntelligence();
  const filterKey = filters
    .map(filter => `${filter.signalName}:${filter.kind === 'theme' ? filter.themeId : 'noise'}`)
    .join(',');
  const examplesContextKey = `${snapshotId}:${selection?.signalName ?? ''}:${selection?.themeId ?? ''}:${filterKey}`;
  const [examplesPage, setExamplesPage] = useState(() => ({ contextKey: examplesContextKey, offset: 0 }));
  const examplesOffset = examplesPage.contextKey === examplesContextKey ? examplesPage.offset : 0;
  const [insightTraceId, setInsightTraceId] = useState<string>();
  const detailQuery = useThemeDetail(
    entityId,
    entityType,
    selection?.signalName ?? 'goal',
    snapshotId,
    selection?.themeId,
  );
  const examplesQuery = useThemeExamples(
    entityId,
    entityType,
    selection?.signalName ?? 'goal',
    snapshotId,
    selection?.themeId,
    EXAMPLES_PAGE_SIZE,
    examplesOffset,
    filters,
  );
  const historyQuery = useThemeHistory(
    entityId,
    entityType,
    selection?.signalName ?? 'goal',
    snapshotTotal > 1 ? selection?.themeId : undefined,
  );
  const title = detailQuery.data?.theme?.label ?? selection?.label ?? 'Theme details';
  const signalName = selection?.signalName;
  const signalDisplayLabel = signalName ? signalLabel(signalCatalog, signalName) : undefined;
  const signalDisplayDescription = signalName ? signalDescription(signalCatalog, signalName) : undefined;
  const historyPoints = historyQuery.data ? chronologicalHistoryPoints(historyQuery.data.points) : [];
  const oldestHistoryPoint = historyPoints[0];

  return (
    <Drawer
      onOpenChange={open => {
        if (!open) {
          setExamplesPage({ contextKey: '', offset: 0 });
          setInsightTraceId(undefined);
          onClose();
        }
      }}
      open={selection !== undefined}
      overlay="none"
      side="right"
      variant="floating"
    >
      <DrawerContent>
        <DrawerHeader className="border-border1 border-b">
          {signalName !== undefined && (
            <span
              className="font-mono text-xs font-semibold tracking-widest"
              style={{ color: nodeColor(getSignalHue(signalName)) }}
            >
              {signalDisplayDescription ? (
                <Tooltip>
                  <TooltipTrigger aria-label={signalDisplayLabel} className="cursor-default uppercase">
                    {signalDisplayLabel}
                  </TooltipTrigger>
                  <TooltipContent>{signalDisplayDescription}</TooltipContent>
                </Tooltip>
              ) : (
                <span className="uppercase">{signalDisplayLabel}</span>
              )}
            </span>
          )}
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className="sr-only">
            Details for the {signalName ?? 'selected'} theme {title}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="grid content-start gap-6 overflow-y-auto p-6">
          {insightTraceId !== undefined && (
            <TraceInsightView traceId={insightTraceId} onBack={() => setInsightTraceId(undefined)} />
          )}
          {insightTraceId === undefined && (
            <>
              {detailQuery.isPending && <p className="text-neutral3 text-sm">Loading theme details…</p>}
              {detailQuery.isError && <p className="text-sm text-red-500">Unable to load theme details.</p>}
              {detailQuery.data && !detailQuery.data.theme && (
                <section>
                  <h2 className="text-neutral6 text-sm font-semibold">Not present in this snapshot</h2>
                  <p className="text-neutral3 mt-2 text-sm">This theme has no data in the selected snapshot.</p>
                </section>
              )}
              {detailQuery.data?.theme && (
                <>
                  <section aria-labelledby="theme-summary-heading">
                    <h2 id="theme-summary-heading" className="text-neutral3 font-mono text-xs tracking-wider uppercase">
                      Summary
                    </h2>
                    <p className="text-neutral5 mt-3 text-sm">
                      {detailQuery.data.theme.description ?? 'No description available.'}
                    </p>
                    <p className="text-neutral5 mt-3 font-mono text-sm tabular-nums">
                      {shareSentence(
                        filteredStats?.traceCount ?? detailQuery.data.theme.traceCount,
                        filteredStats?.stageShare ?? detailQuery.data.theme.coverage,
                      )}
                    </p>
                  </section>

                  <section aria-labelledby="theme-examples-heading">
                    <h2
                      id="theme-examples-heading"
                      className="text-neutral3 font-mono text-xs tracking-wider uppercase"
                    >
                      Examples
                    </h2>
                    {examplesQuery.isPending && <p className="text-neutral3 mt-3 text-sm">Loading examples…</p>}
                    {examplesQuery.isError && <p className="mt-3 text-sm text-red-500">Unable to load examples.</p>}
                    {examplesQuery.data && (
                      <>
                        {examplesQuery.data.examples.length === 0 ? (
                          <p className="text-neutral3 mt-3 text-sm">No examples in this snapshot.</p>
                        ) : (
                          <ul className="mt-3 space-y-3">
                            {examplesQuery.data.examples.map(example => (
                              <li key={example.traceId}>
                                <button
                                  type="button"
                                  aria-label={`View trace insight for ${example.signalText}`}
                                  className="border-border1 bg-surface3 text-neutral5 hover:bg-surface5 w-full cursor-pointer rounded-md border p-3 text-left text-sm"
                                  onClick={() => setInsightTraceId(example.traceId)}
                                >
                                  {example.signalText}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <ExamplesPager
                          traceCount={filteredStats?.traceCount ?? detailQuery.data.theme.traceCount}
                          offset={examplesOffset}
                          onOffsetChange={offset => setExamplesPage({ contextKey: examplesContextKey, offset })}
                        />
                      </>
                    )}
                  </section>

                  {snapshotTotal > 1 && (
                    <section aria-labelledby="theme-trend-heading">
                      <h2 id="theme-trend-heading" className="text-neutral3 font-mono text-xs tracking-wider uppercase">
                        Trend
                      </h2>
                      {historyQuery.isPending && <p className="text-neutral3 mt-3 text-sm">Loading trend…</p>}
                      {historyQuery.isError && <p className="mt-3 text-sm text-red-500">Unable to load the trend.</p>}
                      {oldestHistoryPoint !== undefined && (
                        <>
                          <p className="text-neutral5 mt-3 text-sm">
                            {/* A nextCursor means older points exist beyond the fetched window,
                                so the oldest loaded point is a lower bound, not the true origin. */}
                            {historyQuery.data?.nextCursor
                              ? `Active since at least ${formatSnapshotDate(oldestHistoryPoint.startedAt)} · in ${historyPoints.length}+ snapshots`
                              : `First seen ${formatSnapshotDate(oldestHistoryPoint.startedAt)} · in ${historyPoints.length} ${historyPoints.length === 1 ? 'snapshot' : 'snapshots'}`}{' '}
                            · {themeTrendDirection(historyPoints)}
                          </p>
                          {historyPoints.length >= 2 && (
                            <ThemeTrendChart
                              points={historyPoints}
                              color={nodeColor(getSignalHue(signalName ?? 'goal'))}
                            />
                          )}
                        </>
                      )}
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
