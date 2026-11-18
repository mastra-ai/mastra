import type { GetScorerResponse } from '@mastra/client-js';
import type { ComponentProps, ReactNode } from 'react';

import type { TraceUsageSummary } from '../../trace-list-columns';
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
import { IconLoadingCircle } from '@/ds/icons/central/IconLoadingCircle';
import { TraceIcon } from '@/ds/icons/TraceIcon';
import type { LinkComponent } from '@/ds/types/link-component';

export type TracePanelHeaderProps = ComponentProps<typeof DataPanel.Header>;

/** A header row of the drawer; the navigation row holds `Navigation`, `TraceId` and `Actions`. */
export function TracePanelHeader(props: TracePanelHeaderProps) {
  return <DataPanel.Header {...props} />;
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

export interface TracePanelSummaryContentProps {
  /** Token and estimated-cost totals of the trace. */
  usage?: TraceUsageSummary;
  /** When set with `LinkComponent`, the entity name links to the entity's page. */
  entityHref?: string;
  LinkComponent?: LinkComponent;
}

export interface TracePanelPageHeadingProps extends TracePanelSummaryContentProps {
  children?: ReactNode;
}

/** The heading of a full trace page: a title with the trace summary under it. */
export function TracePanelPageHeading({
  children = 'Trace Timeline',
  usage,
  entityHref,
  LinkComponent,
}: TracePanelPageHeadingProps) {
  const { rootSpan } = useTracePanel();
  return (
    <DataPanel.HeaderContent>
      <DataPanel.Heading>{children}</DataPanel.Heading>
      {rootSpan && (
        <TraceSummaryDescription
          rootSpan={rootSpan}
          usage={usage}
          entityHref={entityHref}
          LinkComponent={LinkComponent}
        />
      )}
    </DataPanel.HeaderContent>
  );
}

export type TracePanelActionsProps = ComponentProps<typeof DataPanel.HeaderActions>;

/** The trailing controls of a header row; any element fits alongside the standard actions. */
export function TracePanelActions(props: TracePanelActionsProps) {
  return <DataPanel.HeaderActions {...props} />;
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

export interface TracePanelOpenPageButtonProps {
  href: string;
  LinkComponent: LinkComponent;
}

/** Opens the trace on its own page. */
export function TracePanelOpenPageButton({ href, LinkComponent }: TracePanelOpenPageButtonProps) {
  return (
    <Button size="icon-sm" variant="ghost" tooltip="Open trace page" render={<LinkComponent href={href} />}>
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
      disabled={isPending}
      onClick={() => onDownload(traceId)}
    >
      {isPending ? <IconLoadingCircle className="animate-spin" /> : <IconArrowInbox />}
    </Button>
  );
}

export interface TracePanelDatasetButtonProps {
  /** Saves the trace as a dataset item; the host owns the dialog. */
  onSaveAsDatasetItem: (args: { traceId: string; rootSpanId: string | undefined }) => void;
}

export function TracePanelDatasetButton({ onSaveAsDatasetItem }: TracePanelDatasetButtonProps) {
  const { traceId, rootSpan } = useTracePanel();
  return (
    <Button
      size="sm"
      tooltip="Add the full trace to a dataset"
      onClick={() => onSaveAsDatasetItem({ traceId, rootSpanId: rootSpan?.spanId })}
    >
      <IconFloppyDisk1 />
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
    <Button variant="primary" size="sm" onClick={onClick ?? (() => setScoring(true))} disabled={!rootSpan}>
      <IconGauge />
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

export type TracePanelSummaryProps = TracePanelSummaryContentProps;

/** What ran and how it ended on the left; timing, tokens and cost on the right. */
export function TracePanelSummary({ usage, entityHref, LinkComponent }: TracePanelSummaryProps) {
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
      <DataPanel.Metadata>
        <TraceEntityMeta rootSpan={rootSpan} entityHref={entityHref} LinkComponent={LinkComponent} />
        <TraceStatusMeta rootSpan={rootSpan} />
      </DataPanel.Metadata>
      <div className="ml-auto flex min-w-0">
        <TraceSummaryDescription
          rootSpan={rootSpan}
          usage={usage}
          entityHref={entityHref}
          LinkComponent={LinkComponent}
          showEntity={false}
          showStatus={false}
        />
      </div>
    </DataPanel.Header>
  );
}
