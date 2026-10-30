import type { KnowledgeImporterRunEvent, KnowledgeImporterRunSummary } from '@mastra/client-js';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerInteractive,
  DrawerTitle,
} from '@mastra/playground-ui/components/Drawer';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import { buildRunLogRows, EMPTY_FILTER_COPY, hasRequestLines } from '../run-log';
import type { RunLogFilter } from '../run-log';
import { RUN_KIND_LABEL } from '../runs';
import { readApiError } from '../settings';
import { useImporterRunEvents } from '../use-knowledge-importers';
import { RunLogLines } from './run-log-lines';

export interface RunLogDrawerProps {
  importerKey: string;
  run: KnowledgeImporterRunSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RunLogDrawer({ importerKey, run, open, onOpenChange }: RunLogDrawerProps) {
  return (
    <Drawer side="right" size="lg" open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{RUN_KIND_LABEL[run.kind]} log</DrawerTitle>
          <DrawerDescription>Every step of this run, as it happens.</DrawerDescription>
        </DrawerHeader>
        {/* Interactive region: otherwise swipe-to-dismiss captures mouse presses, swallowing filter clicks and text selection. */}
        <DrawerInteractive render={<DrawerBody className="flex min-h-0 flex-col gap-3" />}>
          <RunLog importerKey={importerKey} runId={run.id} startedAt={run.startedAt ?? undefined} />
        </DrawerInteractive>
      </DrawerContent>
    </Drawer>
  );
}

const FILTERS: { value: RunLogFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'warnings', label: 'Warnings' },
  { value: 'errors', label: 'Errors' },
];

function RunLog({
  importerKey,
  runId,
  startedAt,
}: {
  importerKey: string;
  runId: string;
  startedAt: string | undefined;
}) {
  const log = useImporterRunEvents(importerKey, runId);
  const [filter, setFilter] = useState<RunLogFilter>('all');
  const [showRequests, setShowRequests] = useState(false);

  if (log.isPending) {
    return (
      <div role="status" aria-label="Loading run log" className="flex flex-col gap-3">
        <SkeletonText />
        <SkeletonText />
      </div>
    );
  }
  if (log.isError) {
    return (
      <Notice variant="destructive" title="Couldn't load the run log">
        <Notice.Message>{readApiError(log.error).message}</Notice.Message>
      </Notice>
    );
  }

  const { events, done } = log.data;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<RunLogFilter> value={filter} onValueChange={setFilter} aria-label="Show levels" size="sm">
          {FILTERS.map(option => (
            <SegmentedControlItem key={option.value} value={option.value}>
              {option.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        {filter === 'all' && hasRequestLines(events) ? (
          <label className="flex items-center gap-2">
            <Switch checked={showRequests} onCheckedChange={setShowRequests} aria-label="Show requests" />
            <Txt as="span" variant="caption" tone="muted">
              Show requests
            </Txt>
          </label>
        ) : null}
      </div>
      <RunLogLines
        rows={buildRunLogRows(events, filter, { showRequests, done })}
        origin={events[0]?.at ?? startedAt}
        emptyCopy={done ? 'Nothing logged at this level.' : EMPTY_FILTER_COPY[filter]}
      />
      {done ? <RunLogOutcome last={events.at(-1)} /> : <RunLogLive />}
    </>
  );
}

function RunLogLive() {
  return (
    <div role="status" className="flex items-center gap-2" data-testid="run-log-live">
      <Spinner size="sm" />
      <Txt as="span" variant="caption" tone="muted">
        Live — new lines appear as the run goes.
      </Txt>
    </div>
  );
}

/** A finished run's last line holds its final counts; a run cut short (e.g. by a restart) has none. */
function RunLogOutcome({ last }: { last: KnowledgeImporterRunEvent | undefined }) {
  const finished = last?.type === 'finished' ? last : undefined;
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border px-3 py-2" data-testid="run-log-outcome">
      <Txt as="h4" variant="eyebrow" tone="muted">
        Final counts
      </Txt>
      <Txt variant="body-sm">{finished?.message ?? 'The run ended without a final summary.'}</Txt>
    </div>
  );
}
