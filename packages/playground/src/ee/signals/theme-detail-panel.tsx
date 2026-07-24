import { Button } from '@mastra/playground-ui/components/Button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@mastra/playground-ui/components/Drawer';
import { useState } from 'react';

import { useThemeDetail, useThemeExamples, useThemeHistory } from './hooks';
import type { ThemeSelection } from './theme-drilldown-data';

interface ThemeDetailPanelProps {
  entityId: string;
  entityType: string;
  snapshotId: string;
  snapshotTotal: number;
  selection: ThemeSelection | undefined;
  onClose: () => void;
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
    5,
    examplesOffset,
  );
  const historyQuery = useThemeHistory(
    entityId,
    entityType,
    selection?.signalName ?? 'goal',
    snapshotTotal > 1 ? selection?.themeId : undefined,
  );
  const title = detailQuery.data?.theme?.label ?? selection?.label ?? 'Theme details';

  return (
    <Drawer
      onOpenChange={open => {
        if (!open) onClose();
      }}
      open={selection !== undefined}
      overlay="none"
      side="right"
      variant="floating"
    >
      <DrawerContent>
        <DrawerHeader className="border-b border-border1">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className="sr-only">Details for {title}</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="grid content-start gap-6 overflow-y-auto p-6">
          {detailQuery.isPending && <p className="text-sm text-neutral3">Loading theme details…</p>}
          {detailQuery.isError && <p className="text-sm text-red-500">Unable to load theme details.</p>}
          {detailQuery.data && !detailQuery.data.theme && (
            <section>
              <h2 className="text-sm font-semibold text-neutral6">Not present in this snapshot</h2>
              <p className="mt-2 text-sm text-neutral3">This theme has no data in the selected snapshot.</p>
            </section>
          )}
          {detailQuery.data?.theme && (
            <>
              <section aria-labelledby="theme-summary-heading">
                <h2 id="theme-summary-heading" className="font-mono text-xs tracking-wider text-neutral3 uppercase">
                  Summary
                </h2>
                <p className="mt-3 text-sm text-neutral5">
                  {detailQuery.data.theme.description ?? 'No description available.'}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-neutral3">Traces</dt>
                    <dd className="mt-1 font-mono text-neutral5">{detailQuery.data.theme.traceCount}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral3">Stage share</dt>
                    <dd className="mt-1 font-mono text-neutral5">
                      {Math.round(detailQuery.data.theme.coverage * 100)}%
                    </dd>
                  </div>
                </dl>
              </section>

              <section aria-labelledby="theme-examples-heading">
                <h2 id="theme-examples-heading" className="font-mono text-xs tracking-wider text-neutral3 uppercase">
                  Examples
                </h2>
                {examplesQuery.isPending && <p className="mt-3 text-sm text-neutral3">Loading examples…</p>}
                {examplesQuery.isError && <p className="mt-3 text-sm text-red-500">Unable to load examples.</p>}
                {examplesQuery.data && (
                  <>
                    {examplesQuery.data.examples.length === 0 ? (
                      <p className="mt-3 text-sm text-neutral3">No examples in this snapshot.</p>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {examplesQuery.data.examples.map(example => (
                          <li
                            key={example.traceId}
                            className="rounded-md border border-border1 bg-surface3 p-3 text-sm text-neutral5"
                          >
                            {example.signalText}
                          </li>
                        ))}
                      </ul>
                    )}
                    {examplesQuery.data.nextOffset !== undefined && (
                      <Button
                        className="mt-3"
                        variant="outline"
                        size="sm"
                        onClick={() => setExamplesOffset(examplesQuery.data.nextOffset ?? 0)}
                      >
                        Next examples
                      </Button>
                    )}
                  </>
                )}
              </section>

              {snapshotTotal > 1 && (
                <section aria-labelledby="theme-history-heading">
                  <h2 id="theme-history-heading" className="font-mono text-xs tracking-wider text-neutral3 uppercase">
                    History
                  </h2>
                  {historyQuery.isPending && <p className="mt-3 text-sm text-neutral3">Loading history…</p>}
                  {historyQuery.isError && <p className="mt-3 text-sm text-red-500">Unable to load history.</p>}
                  {historyQuery.data && (
                    <ol className="mt-3 space-y-3">
                      {historyQuery.data.points.map(point => (
                        <li key={point.snapshotId} className="border-l border-border2 pl-3 text-sm">
                          <p className="font-medium text-neutral5 capitalize">{point.state}</p>
                          <p className="mt-1 font-mono text-xs text-neutral3">
                            {point.traceCount} traces · {Math.round(point.coverage * 100)}%
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              )}
            </>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
