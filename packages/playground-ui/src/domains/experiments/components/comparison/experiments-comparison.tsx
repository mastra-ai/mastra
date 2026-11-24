'use client';

import type { CompareExperimentsResponse, DatasetExperiment } from '@mastra/client-js';
import { useMemo, useState } from 'react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import type { RenameExperimentPatch } from '../rename-experiment-dialog';
import { buildComparisonRows, sideDurationMs } from './build-comparison-rows';
import type { BuildComparisonRowsParams, ComparisonRow } from './build-comparison-rows';
import { ComparisonItemPayload } from './comparison-item-payload';
import { totalTokens } from './comparison-metric-format';
import { sectionStackClass } from './comparison-section';
import { ComparisonSideCell } from './comparison-side-cell';
import { ComparisonSideSummary, ComparisonSideTitle } from './comparison-side-header';
import type { ComparisonSideMetrics, ScorerSummary } from './comparison-side-header';
import { columnLabel } from './constants';
import { Notice } from '@/ds/components/Notice';
import { Spinner } from '@/ds/components/Spinner';
import { Txt } from '@/ds/components/Txt';
import { focusRingInset } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';

export interface ExperimentsComparisonProps {
  /** The baseline first, then the contenders in column order. */
  experimentIds: string[];
  comparison?: CompareExperimentsResponse;
  experimentsById: Record<string, DatasetExperiment | undefined>;
  /** Every result of each experiment, keyed by experiment id. */
  resultsById?: BuildComparisonRowsParams['resultsById'];
  /** Scores of each experiment grouped by item id, keyed by experiment id; they carry the scorer reasons. */
  scoresById?: BuildComparisonRowsParams['scoresById'];
  /** Usage of each experiment, keyed by experiment id. */
  usageById?: BuildComparisonRowsParams['usageById'];
  /** Shows a spinner instead of the table, e.g. while the comparison or experiments load. */
  isLoading: boolean;
  /** Keeps the cells and run metrics loading while the results load. */
  isResultsLoading: boolean;
  error?: Error;
  /** Shows the cost and token metrics. */
  supportsMetrics: boolean;
  /** Makes the given contender the baseline. */
  onSetBaseline?: (experimentId: string) => void;
  /** When provided, each column title offers to rename its experiment. */
  onRenameExperiment?: (experiment: DatasetExperiment, patch: RenameExperimentPatch) => Promise<void>;
  /**
   * Renders the dataset item of a clicked row, e.g. a `ComparisonItemPanel`. It stays rendered
   * while closed (`itemId` undefined) so a drawer can animate. Omit it and rows don't open.
   */
  itemPanel?: (item: { itemId?: string; onClose: () => void }) => ReactNode;
  /** Renders the trace of a cell, like `itemPanel`. Omit it and cells offer no trace link. */
  tracePanel?: (trace: { traceId?: string; onClose: () => void }) => ReactNode;
}

const cell = 'min-w-0 px-4 py-3';

/**
 * Items column plus one column per experiment. N is dynamic, so it goes through a CSS variable.
 * The columns keep their width at every viewport size: the page scrolls sideways instead.
 */
const gridRow =
  'grid grid-cols-[minmax(22rem,26rem)_repeat(var(--compare-cols),minmax(32rem,1fr))] divide-x divide-border border-border';

/**
 * Rows open on click, but their buttons, links and fields keep their own behaviour. Portaled
 * content (tooltips, popovers) bubbles through React yet sits outside the row in the DOM.
 */
const isFromControl = (event: MouseEvent<HTMLElement>) =>
  !(event.target instanceof Element) ||
  !event.currentTarget.contains(event.target) ||
  event.target.closest(
    'a, button, input, select, textarea, [role="button"], [role="link"], [data-slot="collapsible-box-fade"]',
  ) !== null;

/** Selecting text to copy it shouldn't open the item. */
const hasTextSelection = () => Boolean(window.getSelection()?.toString());

const renameHandler = (
  experiment: DatasetExperiment | undefined,
  onRenameExperiment: ExperimentsComparisonProps['onRenameExperiment'],
) =>
  experiment && onRenameExperiment
    ? (patch: RenameExperimentPatch) => onRenameExperiment(experiment, patch)
    : undefined;

const isNumber = (value: number | null): value is number => value != null;

const mean = (values: number[]) =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const average = (rows: ComparisonRow[], index: number, scorerId: string) =>
  mean(
    rows
      .map(row => row.sides[index]?.scores.find(score => score.scorerId === scorerId)?.value ?? null)
      .filter(isNumber),
  );

const columnMetrics = (rows: ComparisonRow[], index: number): ComparisonSideMetrics => {
  const sides = rows.flatMap(row => {
    const side = row.sides[index];
    return side?.present ? [side] : [];
  });
  return {
    errorCount: sides.filter(side => side.error).length,
    averageScore: mean(sides.flatMap(side => side.scores.map(score => score.value)).filter(isNumber)),
    averageDurationMs: mean(sides.map(sideDurationMs).filter(isNumber)),
  };
};

/**
 * Comparison table of a baseline and one or more contender experiments. Every item is a
 * row, with each experiment side by side so a change reads as a diff against the baseline.
 */
export function ExperimentsComparison({
  experimentIds,
  comparison,
  experimentsById,
  resultsById,
  scoresById,
  usageById,
  isLoading,
  isResultsLoading,
  error,
  supportsMetrics,
  onSetBaseline,
  onRenameExperiment,
  itemPanel,
  tracePanel,
}: ExperimentsComparisonProps) {
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [featuredTraceId, setFeaturedTraceId] = useState<string>();
  // One drawer at a time: the item and the trace replace each other.
  const openItem = (itemId: string) => {
    setFeaturedTraceId(undefined);
    setSelectedItemId(itemId);
  };
  const showTrace = (traceId: string) => {
    setSelectedItemId(undefined);
    setFeaturedTraceId(traceId);
  };

  const rows = useMemo(
    () => buildComparisonRows({ comparison, experimentIds, resultsById, scoresById, usageById }),
    [comparison, experimentIds, resultsById, scoresById, usageById],
  );

  /** Per-scorer averages for each column; contenders also carry their delta against the baseline. */
  const summaries = useMemo((): ScorerSummary[][] => {
    const scorerIds = [
      ...new Set(rows.flatMap(row => row.sides.flatMap(side => side.scores.map(s => s.scorerId)))),
    ].sort();
    return experimentIds.map((_, index) =>
      scorerIds.map(scorerId => {
        const value = average(rows, index, scorerId);
        const baseline = average(rows, 0, scorerId);
        const delta = index > 0 && value != null && baseline != null ? value - baseline : null;
        return { scorerId, average: value, delta };
      }),
    );
  }, [rows, experimentIds]);

  const metrics = useMemo(
    () =>
      experimentIds.map((experimentId, index): ComparisonSideMetrics => {
        const summary = usageById?.[experimentId]?.summary;
        return {
          ...columnMetrics(rows, index),
          cost: summary?.estimatedCost,
          costUnit: summary?.costUnit,
          tokens: totalTokens(summary),
        };
      }),
    [rows, experimentIds, usageById],
  );

  if (isLoading) {
    // Centred on the viewport, like the app boot spinner, so swapping from one to the other doesn't shift.
    return (
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Notice variant="warning" title="Error loading comparison">
        <Notice.Message>{error.message}</Notice.Message>
      </Notice>
    );
  }

  if (!comparison || comparison.items.length === 0) {
    return (
      <Txt as="p" variant="body" tone="muted" className="py-5 text-center">
        No comparison data
      </Txt>
    );
  }

  const baselineExperiment = experimentsById[experimentIds[0] ?? ''];

  return (
    <>
      <div
        role="table"
        aria-label="Experiments comparison"
        // The column minimums set the width: max-content would stretch columns to the unwrapped text.
        className="grid min-w-[calc(22rem_+_var(--compare-cols)_*_32rem)]"
        style={{ '--compare-cols': experimentIds.length } as CSSProperties}
      >
        {/* Titles stay pinned while scrolling down, so every column still says which experiment it is. */}
        <div role="row" className={cn(gridRow, 'sticky top-0 z-20 bg-background')}>
          <div role="columnheader" aria-label="Items" className={cell} />
          {experimentIds.map((experimentId, index) => (
            <div
              key={experimentId}
              role="columnheader"
              aria-label={columnLabel(index)}
              className={cn(cell, 'border-b')}
            >
              <ComparisonSideTitle
                role={index === 0 ? 'baseline' : 'contender'}
                label={columnLabel(index)}
                experiment={experimentsById[experimentId]}
                onSetBaseline={index > 0 && onSetBaseline ? () => onSetBaseline(experimentId) : undefined}
                onRename={renameHandler(experimentsById[experimentId], onRenameExperiment)}
              />
            </div>
          ))}
        </div>

        <div role="row" aria-label="Summary" className={cn(gridRow, 'border-b')}>
          <div role="cell" aria-label="Items" className={cell} />
          {experimentIds.map((experimentId, index) => {
            const experiment = experimentsById[experimentId];
            return (
              <div key={experimentId} role="cell" aria-label={columnLabel(index)} className={cell}>
                <ComparisonSideSummary
                  role={index === 0 ? 'baseline' : 'contender'}
                  experiment={experiment}
                  summary={summaries[index]}
                  metrics={isResultsLoading ? undefined : metrics[index]}
                  baselineMetrics={isResultsLoading ? undefined : metrics[0]}
                  versionMismatch={
                    index > 0 && Boolean(experiment) && Boolean(baselineExperiment)
                      ? experiment?.datasetVersion !== baselineExperiment?.datasetVersion
                      : undefined
                  }
                  showUsage={supportsMetrics}
                />
              </div>
            );
          })}
        </div>

        {rows.map(row => (
          <ComparisonRowView
            key={row.itemId}
            row={row}
            isLoading={isResultsLoading}
            showUsage={supportsMetrics}
            onOpen={itemPanel ? () => openItem(row.itemId) : undefined}
            onShowTrace={tracePanel ? showTrace : undefined}
          />
        ))}
      </div>
      {itemPanel?.({ itemId: selectedItemId, onClose: () => setSelectedItemId(undefined) })}
      {tracePanel?.({ traceId: featuredTraceId, onClose: () => setFeaturedTraceId(undefined) })}
    </>
  );
}

type ExpandableSection = 'input' | 'groundTruth' | 'output';

interface ComparisonRowViewProps {
  row: ComparisonRow;
  isLoading: boolean;
  showUsage: boolean;
  /** Opens the row's item; rows without it are not interactive. */
  onOpen?: () => void;
  onShowTrace?: (traceId: string) => void;
}

/** One item of the comparison. Expanding a section expands the same section in every column of the row. */
function ComparisonRowView({ row, isLoading, showUsage, onOpen, onShowTrace }: ComparisonRowViewProps) {
  const [expanded, setExpanded] = useState<Record<ExpandableSection, boolean>>({
    input: false,
    groundTruth: false,
    output: false,
  });
  const expandedProps = (section: ExpandableSection) => ({
    expanded: expanded[section],
    onExpandedChange: (value: boolean) => setExpanded(current => ({ ...current, [section]: value })),
  });
  const output = expandedProps('output');

  return (
    <div
      role="row"
      aria-label={row.itemId}
      tabIndex={onOpen ? 0 : undefined}
      onClick={event => {
        if (!onOpen || isFromControl(event) || hasTextSelection()) return;
        onOpen();
      }}
      onKeyDown={event => {
        if (!onOpen || event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onOpen();
      }}
      className={cn(
        gridRow,
        'border-b',
        onOpen && 'cursor-pointer transition-colors duration-normal ease-out-custom hover:bg-fill-subtle',
        onOpen && focusRingInset,
      )}
    >
      <div role="cell" className={cn(cell, sectionStackClass)}>
        <ComparisonItemPayload label="Input" value={row.input} {...expandedProps('input')} />
        <ComparisonItemPayload label="Ground truth" value={row.groundTruth} {...expandedProps('groundTruth')} />
      </div>

      {row.sides.map((side, index) => (
        <div key={side.experimentId} role="cell" aria-label={columnLabel(index)} className={cell}>
          <ComparisonSideCell
            column={side}
            isLoading={isLoading}
            showUsage={showUsage}
            outputExpanded={output.expanded}
            onOutputExpandedChange={output.onExpandedChange}
            onShowTrace={onShowTrace}
          />
        </div>
      ))}
    </div>
  );
}
