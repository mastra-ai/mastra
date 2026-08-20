import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useMemo, useState } from 'react';

import { useRunningSessions, useWorkItemsQuery } from '../../hooks/useWorkItems';
import { Chip, ChipRow } from '../domains/factory/components/Chips';
import { DocumentFactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { WorkItemTraces } from '../domains/factory/components/WorkItemTraces';
import { TRACE_WINDOWS, tracedInWindow, underAgent } from '../domains/factory/traces';

function movedNote(cards: number, label: string, live: number): string {
  const moved = `${cards} ${cards === 1 ? 'card' : 'cards'} moved in the last ${label}`;
  return live === 0 ? moved : `${moved} · ${live} still under an agent`;
}

export function TracesPage() {
  return (
    <DocumentFactoryPageShell>{project => <TracesContent factoryProjectId={project.id} />}</DocumentFactoryPageShell>
  );
}

/** One row per card, length is time — where the board spent it, and on what. */
function TracesContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [windowId, setWindowId] = useState(TRACE_WINDOWS[0]!.id);
  const itemsQuery = useWorkItemsQuery(factoryProjectId);
  const running = useRunningSessions(factoryProjectId);
  const traceWindow = TRACE_WINDOWS.find(entry => entry.id === windowId) ?? TRACE_WINDOWS[0]!;
  const items = itemsQuery.data;
  // the board polls every few seconds; "now" moves with it, so the marker never drifts
  const now = useMemo(() => Date.now(), [items]);
  const traced = items ? tracedInWindow(items, traceWindow, now) : undefined;

  if (itemsQuery.isError) {
    const message = itemsQuery.error instanceof Error ? itemsQuery.error.message : 'Failed to load the board';
    return <Notice variant="destructive">{message}</Notice>;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-16">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="sr-only">Traces</h1>
        {traced ? (
          <Txt as="p" variant="ui-xs" className="text-icon3 m-0">
            {movedNote(traced.length, traceWindow.label, underAgent(traced, running))}
          </Txt>
        ) : null}
        <div className="ml-auto">
          <ChipRow label="Trace window">
            {TRACE_WINDOWS.map(entry => (
              <Chip key={entry.id} active={entry.id === traceWindow.id} onClick={() => setWindowId(entry.id)}>
                {entry.label}
              </Chip>
            ))}
          </ChipRow>
        </div>
      </div>

      {traced ? (
        <WorkItemTraces traced={traced} running={running} window={traceWindow} now={now} />
      ) : (
        <Skeleton className="h-96 w-full rounded-lg" />
      )}
    </div>
  );
}
