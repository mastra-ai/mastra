import type { GetScorerResponse } from '@mastra/client-js';
import type { ComponentProps, ReactNode } from 'react';

import type { TraceUsageSummary } from '../../trace-list-columns';
import { getEntityOpener, useTraceNavigation } from '../trace-navigation';
import { TraceEntityMeta, TraceStatusMeta, TraceSummaryDescription } from '../trace-summary-description';
import { useTracePanel } from './trace-panel-context';
import { SpanScoring } from '@/domains/scores/components/span-scoring';
import type { TriggerScorerArgs } from '@/domains/scores/components/span-scoring';
import { Button } from '@/ds/components/Button';
import { DataPanel } from '@/ds/components/DataPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { Skeleton } from '@/ds/components/Skeleton';
import { IconArrowInbox } from '@/ds/icons/central/IconArrowInbox';
import { IconChainLink3 } from '@/ds/icons/central/IconChainLink3';
import { IconFloppyDisk1 } from '@/ds/icons/central/IconFloppyDisk1';
import { IconGauge } from '@/ds/icons/central/IconGauge';
import { TraceIcon } from '@/ds/icons/TraceIcon';

export interface TracePanelHeaderProps {
  /** Before the title, e.g. `TracePanel.Navigation`. */
  navigation?: ReactNode;
  /** Typically `TracePanel.TraceId`, or `TracePanel.PageHeading` on a trace page. */
  title?: ReactNode;
  /** Trailing controls, e.g. `TracePanel.ScoreButton`, `TracePanel.DownloadButton`, `TracePanel.CloseButton`. */
  actions?: ReactNode;
}

/** The header row: navigation and title on the left, actions on the right. */
export function TracePanelHeader({ navigation, title, actions }: TracePanelHeaderProps) {
  return (
    <DataPanel.Header>
      {navigation}
      {title}
      {actions && <DataPanel.HeaderActions>{actions}</DataPanel.HeaderActions>}
    </DataPanel.Header>
  );
}

export interface TracePanelNavigationProps {
  onPrevious?: () => void;
  onNext?: () => void;
}

/** Steps to the previous or next trace of the host's list; renders nothing without either. */
export function TracePanelNavigation({ onPrevious, onNext }: TracePanelNavigationProps) {
  if (!onPrevious && !onNext) return null;
  return (
    <DataPanel.NextPrevNav
      onPrevious={onPrevious}
      onNext={onNext}
      previousLabel="Go to previous trace"
      nextLabel="Go to next trace"
    />
  );
}

/** The trace id, short and copyable, as the drawer's heading. */
export function TracePanelTraceId() {
  const { traceId } = useTracePanel();
  return (
    <DataPanel.HeaderContent>
      <DataPanel.Heading>
        <span className="sr-only">Trace</span>
        <DataPanel.CopyId id={traceId} maxLength={6} ellipsis={false} icon={<TraceIcon />} />
      </DataPanel.Heading>
    </DataPanel.HeaderContent>
  );
}

export interface TracePanelPageHeadingProps {
  /** Token and estimated-cost totals of the trace. */
  usage?: TraceUsageSummary;
  children?: ReactNode;
}

/** The heading of a full trace page: a title with the trace summary under it. The entity opens through the root's navigation. */
export function TracePanelPageHeading({ children = 'Trace Timeline', usage }: TracePanelPageHeadingProps) {
  const { rootSpan } = useTracePanel();
  const onOpenEntity = getEntityOpener(useTraceNavigation(), rootSpan);
  return (
    <DataPanel.HeaderContent>
      <DataPanel.Heading>{children}</DataPanel.Heading>
      {rootSpan && <TraceSummaryDescription rootSpan={rootSpan} usage={usage} onOpenEntity={onOpenEntity} />}
    </DataPanel.HeaderContent>
  );
}

/** Closes the drawer through the root's `onClose`, set apart from the actions before it. */
export function TracePanelCloseButton() {
  const { onClose } = useTracePanel();
  return (
    <>
      <div aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border-strong" />
      <DataPanel.CloseButton icon="x" onClick={onClose} label="Close trace" tooltip="Close trace" />
    </>
  );
}

/** Opens the trace on its own page, through the root's `navigation.onOpenTrace`; renders nothing without it. */
export function TracePanelOpenPageButton() {
  const { traceId } = useTracePanel();
  const { onOpenTrace } = useTraceNavigation();
  if (!onOpenTrace || !traceId) return null;
  return (
    <Button size="icon-sm" variant="ghost" tooltip="Open trace page" onClick={() => onOpenTrace(traceId)}>
      <IconChainLink3 />
    </Button>
  );
}

export interface TracePanelDownloadButtonProps {
  /** Loads and saves the trace; the host decides how (Studio: `useDownloadTraceJson`). */
  onDownload: (traceId: string) => void;
  /** A download is in flight: the button waits for it. */
  isPending?: boolean;
}

export function TracePanelDownloadButton({ onDownload, isPending = false }: TracePanelDownloadButtonProps) {
  const { traceId } = useTracePanel();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      tooltip="Download trace JSON"
      onClick={() => onDownload(traceId)}
      loading={isPending}
    >
      <IconArrowInbox />
    </Button>
  );
}

export interface TracePanelDatasetButtonProps {
  /** Saves the trace as a dataset item; the host owns the dialog. */
  onSaveAsDatasetItem: (args: { traceId: string; rootSpanId: string | undefined }) => void;
}

/** "Add to dataset", waiting for the root span the dataset item is built from. */
export function TracePanelDatasetButton({ onSaveAsDatasetItem }: TracePanelDatasetButtonProps) {
  const { traceId, rootSpan } = useTracePanel();
  return (
    <Button
      icon={<IconFloppyDisk1 />}
      size="sm"
      tooltip="Add the full trace to a dataset"
      onClick={() => onSaveAsDatasetItem({ traceId, rootSpanId: rootSpan?.spanId })}
      disabled={!rootSpan}
    >
      Add to dataset
    </Button>
  );
}

export interface TracePanelScoreButtonProps {
  /** The host's own scoring flow; omitted, it opens the panel's `TracePanel.ScoreDialog`. */
  onClick?: () => void;
}

/** "Score trace", waiting for the root span the scorer would run on. */
export function TracePanelScoreButton({ onClick }: TracePanelScoreButtonProps) {
  const { rootSpan, setScoring } = useTracePanel();
  return (
    <Button
      icon={<IconGauge />}
      variant="primary"
      size="sm"
      onClick={onClick ?? (() => setScoring(true))}
      disabled={!rootSpan}
    >
      Score trace
    </Button>
  );
}

export interface TracePanelScoreDialogProps {
  /** The scorers to offer (`listScorers`); `undefined` once loaded means they failed to load. */
  scorers?: Record<string, GetScorerResponse>;
  isLoadingScorers?: boolean;
  /** Starts the picked scorer on the root span; resolve once it started. */
  onTriggerScorer: (args: TriggerScorerArgs) => Promise<unknown>;
}

/**
 * The scorer picker `TracePanel.ScoreButton` opens. Once a scorer started, the side column opens on
 * Scores. Render it next to `TracePanel.Frame`, not inside it: a dialog nested in the drawer would leave
 * its scorer list inert.
 */
export function TracePanelScoreDialog({ scorers, isLoadingScorers, onTriggerScorer }: TracePanelScoreDialogProps) {
  const { traceId, rootSpan, isScoring, setScoring, setSideView } = useTracePanel();
  return (
    <Dialog open={isScoring} onOpenChange={setScoring}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Score trace</DialogTitle>
        </DialogHeader>
        {isScoring && traceId && rootSpan && (
          <SpanScoring
            traceId={traceId}
            spanId={rootSpan.spanId}
            entityType={rootSpan.entityType === 'agent' ? 'Agent' : 'Workflow'}
            isTopLevelSpan={!rootSpan.parentSpanId}
            scorers={scorers}
            isLoadingScorers={isLoadingScorers}
            onTriggerScorer={onTriggerScorer}
            onSuccess={() => {
              setScoring(false);
              setSideView('scores');
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export interface TracePanelSummaryProps {
  /** What ran, e.g. `TracePanel.Entity`. */
  entity?: ReactNode;
  /** How it ended, e.g. `TracePanel.Status`. */
  status?: ReactNode;
  /** Timing, tokens and cost on the right, e.g. `TracePanel.Stats`. */
  stats?: ReactNode;
}

/** The summary row: what ran and how it ended on the left, the numbers on the right. Placeholders while the trace loads. */
export function TracePanelSummary({ entity, status, stats }: TracePanelSummaryProps) {
  const { rootSpan, isLoading } = useTracePanel();
  if (!rootSpan) {
    if (!isLoading) return null;
    return (
      <DataPanel.Header>
        <div role="status" aria-label="Loading trace summary" className="flex w-full items-center gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="ml-auto h-3 w-48" />
        </div>
      </DataPanel.Header>
    );
  }
  return (
    <DataPanel.Header>
      {(entity || status) && (
        <DataPanel.Metadata>
          {entity}
          {status}
        </DataPanel.Metadata>
      )}
      {stats && <div className="ml-auto flex min-w-0">{stats}</div>}
    </DataPanel.Header>
  );
}

/**
 * The entity the trace ran (agent, workflow…), from the root span. It opens through the root's
 * `navigation.onOpenAgent` / `onOpenWorkflow`, and shows as text without them.
 */
export function TracePanelEntity() {
  const { rootSpan } = useTracePanel();
  const onOpenEntity = getEntityOpener(useTraceNavigation(), rootSpan);
  if (!rootSpan) return null;
  return <TraceEntityMeta rootSpan={rootSpan} onOpenEntity={onOpenEntity} />;
}

/** How the trace ended, from the root span. */
export function TracePanelStatus() {
  const { rootSpan } = useTracePanel();
  if (!rootSpan) return null;
  return <TraceStatusMeta rootSpan={rootSpan} />;
}

export interface TracePanelStatsProps {
  /** Token and estimated-cost totals of the trace. */
  usage?: TraceUsageSummary;
}

/** When the trace started, how long it took, its tokens and cost. */
export function TracePanelStats({ usage }: TracePanelStatsProps) {
  const { rootSpan } = useTracePanel();
  if (!rootSpan) return null;
  return <TraceSummaryDescription rootSpan={rootSpan} usage={usage} showEntity={false} showStatus={false} />;
}
