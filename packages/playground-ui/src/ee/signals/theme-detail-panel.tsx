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
import { Txt } from '@/ds/components/Txt';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

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
        <DrawerHeader className="border-b border-border">
          {signalName !== undefined && (
            <Txt as="span" variant="column" style={{ color: nodeColor(getSignalHue(signalName)) }}>
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
            </Txt>
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
              {detailQuery.isPending && (
                <Txt variant="body" tone="muted">
                  Loading theme details…
                </Txt>
              )}
              {detailQuery.isError && (
                <Txt variant="body" className="text-error">
                  Unable to load theme details.
                </Txt>
              )}
              {detailQuery.data && !detailQuery.data.theme && (
                <section>
                  <Txt as="h2" variant="subheading" tone="ink">
                    Not present in this snapshot
                  </Txt>
                  <Txt variant="body" tone="muted" className="mt-2">
                    This theme has no data in the selected snapshot.
                  </Txt>
                </section>
              )}
              {detailQuery.data?.theme && (
                <>
                  <section aria-labelledby="theme-summary-heading">
                    <Txt id="theme-summary-heading" as="h2" variant="column" tone="muted" className="uppercase">
                      Summary
                    </Txt>
                    <Txt variant="body" tone="ink" className="mt-3">
                      {detailQuery.data.theme.description ?? 'No description available.'}
                    </Txt>
                    <Txt variant="body" tone="ink" className="mt-3 tabular-nums">
                      {shareSentence(
                        filteredStats?.traceCount ?? detailQuery.data.theme.traceCount,
                        filteredStats?.stageShare ?? detailQuery.data.theme.coverage,
                      )}
                    </Txt>
                  </section>

                  <section aria-labelledby="theme-examples-heading">
                    <Txt id="theme-examples-heading" as="h2" variant="column" tone="muted" className="uppercase">
                      Examples
                    </Txt>
                    {examplesQuery.isPending && (
                      <Txt variant="body" tone="muted" className="mt-3">
                        Loading examples…
                      </Txt>
                    )}
                    {examplesQuery.isError && (
                      <Txt variant="body" className="mt-3 text-error">
                        Unable to load examples.
                      </Txt>
                    )}
                    {examplesQuery.data && (
                      <>
                        {examplesQuery.data.examples.length === 0 ? (
                          <Txt variant="body" tone="muted" className="mt-3">
                            No examples in this snapshot.
                          </Txt>
                        ) : (
                          <ul className="mt-3 space-y-3">
                            {examplesQuery.data.examples.map(example => (
                              <li key={example.traceId}>
                                <button
                                  type="button"
                                  aria-label={`View trace insight for ${example.signalText}`}
                                  className={cn(
                                    raisedSurfaceStyle,
                                    'state-layer w-full cursor-pointer rounded-md p-3 text-left text-body text-foreground',
                                  )}
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
                      <Txt id="theme-trend-heading" as="h2" variant="column" tone="muted" className="uppercase">
                        Trend
                      </Txt>
                      {historyQuery.isPending && (
                        <Txt variant="body" tone="muted" className="mt-3">
                          Loading trend…
                        </Txt>
                      )}
                      {historyQuery.isError && (
                        <Txt variant="body" className="mt-3 text-error">
                          Unable to load the trend.
                        </Txt>
                      )}
                      {oldestHistoryPoint !== undefined && (
                        <>
                          <Txt variant="body" tone="ink" className="mt-3">
                            {/* A nextCursor means older points exist beyond the fetched window,
                                so the oldest loaded point is a lower bound, not the true origin. */}
                            {historyQuery.data?.nextCursor
                              ? `Active since at least ${formatSnapshotDate(oldestHistoryPoint.startedAt)} · in ${historyPoints.length}+ snapshots`
                              : `First seen ${formatSnapshotDate(oldestHistoryPoint.startedAt)} · in ${historyPoints.length} ${historyPoints.length === 1 ? 'snapshot' : 'snapshots'}`}{' '}
                            · {themeTrendDirection(historyPoints)}
                          </Txt>
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
