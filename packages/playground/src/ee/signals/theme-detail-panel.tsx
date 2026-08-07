import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@mastra/playground-ui/components/Drawer';
import { nodeColor } from '@mastra/playground-ui/components/SankeyChart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { getSignalHue } from '@mastra/playground-ui/ee/signals';
import { useState } from 'react';

import { EXAMPLES_PAGE_SIZE, ExamplesPager } from './examples-pager';
import { useThemeDetail, useThemeExamples, useThemeHistory } from './hooks';
import { formatSnapshotDate, shareSentence, SIGNAL_DESCRIPTIONS, traceLabel } from './signal-formatting';
import type { ThemeSelection } from './theme-drilldown-data';
import { chronologicalHistoryPoints, themeTrendDirection } from './theme-trend-data';
import type { ThemeHistoryPoint } from './theme-trend-data';
import { TraceInsightView } from './trace-insight-view';

const TREND_CHART_HEIGHT = 32;

interface ThemeDetailPanelProps {
  entityId: string;
  entityType: string;
  snapshotId: string;
  snapshotTotal: number;
  selection: ThemeSelection | undefined;
  onClose: () => void;
}

function trendPointLabel(point: ThemeHistoryPoint) {
  return `${formatSnapshotDate(point.startedAt)} · ${traceLabel(point.traceCount)} (${Math.round(point.coverage * 100)}%)`;
}

/**
 * Trace count over time for one theme. Absent stretches (death points with
 * zero traces) drop the area to the baseline, so a theme's rise and fall —
 * including disappearing and coming back — reads without clustering jargon.
 */
function TrendChart({ points, color }: { points: ThemeHistoryPoint[]; color: string }) {
  const firstTime = new Date(points[0].startedAt).getTime();
  const lastTime = new Date(points[points.length - 1].startedAt).getTime();
  const timeSpan = lastTime - firstTime;
  const maxCount = Math.max(1, ...points.map(point => point.traceCount));
  const x = (point: ThemeHistoryPoint) =>
    timeSpan === 0 ? 50 : ((new Date(point.startedAt).getTime() - firstTime) / timeSpan) * 100;
  const y = (point: ThemeHistoryPoint) => (1 - point.traceCount / maxCount) * (TREND_CHART_HEIGHT - 4) + 2;
  const coordinates = points.map(point => `${x(point)},${y(point)}`);

  return (
    <div className="mt-3">
      <div className="relative h-8" data-testid="trend-chart">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full"
          preserveAspectRatio="none"
          viewBox={`0 0 100 ${TREND_CHART_HEIGHT}`}
        >
          <polygon
            fill={color}
            fillOpacity={0.14}
            points={[`0,${TREND_CHART_HEIGHT}`, ...coordinates, `100,${TREND_CHART_HEIGHT}`].join(' ')}
          />
          <polyline
            fill="none"
            stroke={color}
            strokeOpacity={0.7}
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
            points={coordinates.join(' ')}
          />
        </svg>
        {points.map(point => {
          const label = trendPointLabel(point);
          return (
            <Tooltip key={point.snapshotId}>
              <TooltipTrigger
                aria-label={label}
                className="absolute size-2 -translate-x-1/2 -translate-y-1/2 cursor-default rounded-full hover:brightness-125"
                style={{
                  left: `${x(point)}%`,
                  top: `${(y(point) / TREND_CHART_HEIGHT) * 100}%`,
                  backgroundColor: color,
                }}
              />
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="text-neutral3 mt-1 flex justify-between font-mono text-[11px]">
        <span>{formatSnapshotDate(points[0].startedAt)}</span>
        <span>{formatSnapshotDate(points[points.length - 1].startedAt)}</span>
      </div>
    </div>
  );
}

export function ThemeDetailPanel({
  entityId,
  entityType,
  snapshotId,
  snapshotTotal,
  selection,
  onClose,
}: ThemeDetailPanelProps) {
  const [examplesOffset, setExamplesOffset] = useState(0);
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
  );
  const historyQuery = useThemeHistory(
    entityId,
    entityType,
    selection?.signalName ?? 'goal',
    snapshotTotal > 1 ? selection?.themeId : undefined,
  );
  const title = detailQuery.data?.theme?.label ?? selection?.label ?? 'Theme details';
  const signalName = selection?.signalName;
  const historyPoints = historyQuery.data ? chronologicalHistoryPoints(historyQuery.data.points) : [];

  return (
    <Drawer
      onOpenChange={open => {
        if (!open) {
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
              <Tooltip>
                <TooltipTrigger className="cursor-default uppercase">{signalName}</TooltipTrigger>
                <TooltipContent>{SIGNAL_DESCRIPTIONS[signalName]}</TooltipContent>
              </Tooltip>
              <span aria-hidden="true"> theme</span>
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
                      {shareSentence(detailQuery.data.theme.traceCount, detailQuery.data.theme.coverage)}
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
                          traceCount={detailQuery.data.theme.traceCount}
                          offset={examplesOffset}
                          onOffsetChange={setExamplesOffset}
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
                      {historyPoints.length > 0 && (
                        <>
                          <p className="text-neutral5 mt-3 text-sm">
                            First seen {formatSnapshotDate(historyPoints[0].startedAt)} · in{' '}
                            {Math.min(historyPoints.length, snapshotTotal)} of {snapshotTotal} snapshots ·{' '}
                            {themeTrendDirection(historyPoints)}
                          </p>
                          {historyPoints.length >= 2 && (
                            <TrendChart points={historyPoints} color={nodeColor(getSignalHue(signalName ?? 'goal'))} />
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
