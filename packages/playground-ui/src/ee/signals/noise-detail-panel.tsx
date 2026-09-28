import { useState } from 'react';

import { EXAMPLES_PAGE_SIZE, ExamplesPager } from './examples-pager';
import { useNoise, useNoiseExamples } from './hooks';
import { shareSentence } from './signal-formatting';
import type { ThemeSelection, ThemeSelectionStats } from './theme-drilldown-data';
import { TraceInsightView } from './trace-insight-view';
import type { TraceSignalName } from './types';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/ds/components/Drawer';
import { Txt } from '@/ds/components/Txt';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

interface NoiseDetailPanelProps {
  entityId: string;
  entityType: string;
  snapshotId: string;
  signalName: TraceSignalName | undefined;
  filters?: ThemeSelection[];
  filteredStats?: ThemeSelectionStats;
  onClose: () => void;
}

export function NoiseDetailPanel({
  entityId,
  entityType,
  snapshotId,
  signalName,
  filters = [],
  filteredStats,
  onClose,
}: NoiseDetailPanelProps) {
  const filterKey = filters
    .map(filter => `${filter.signalName}:${filter.kind === 'theme' ? filter.themeId : 'noise'}`)
    .join(',');
  const examplesContextKey = `${snapshotId}:${signalName ?? ''}:${filterKey}`;
  const [examplesPage, setExamplesPage] = useState(() => ({ contextKey: examplesContextKey, offset: 0 }));
  const examplesOffset = examplesPage.contextKey === examplesContextKey ? examplesPage.offset : 0;
  const [insightTraceId, setInsightTraceId] = useState<string>();
  const noiseQuery = useNoise(entityId, entityType, signalName, snapshotId);
  const examplesQuery = useNoiseExamples(
    entityId,
    entityType,
    signalName,
    snapshotId,
    EXAMPLES_PAGE_SIZE,
    examplesOffset,
    filters,
  );

  return (
    <Drawer
      onOpenChange={open => {
        if (!open) {
          setExamplesPage({ contextKey: '', offset: 0 });
          setInsightTraceId(undefined);
          onClose();
        }
      }}
      open={signalName !== undefined}
      overlay="none"
      side="right"
      variant="floating"
    >
      <DrawerContent>
        <DrawerHeader className="border-b border-border">
          <DrawerTitle>Noise</DrawerTitle>
          <DrawerDescription className="sr-only">Noise details for the {signalName} trace signal</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="grid content-start gap-6 overflow-y-auto p-6">
          {insightTraceId !== undefined && (
            <TraceInsightView traceId={insightTraceId} onBack={() => setInsightTraceId(undefined)} />
          )}
          {insightTraceId === undefined && (
            <>
              <section aria-labelledby="noise-summary-heading">
                <Txt id="noise-summary-heading" as="h2" variant="column" tone="muted" className="uppercase">
                  Summary
                </Txt>
                <Txt variant="body" tone="ink" className="mt-3">
                  Noise contains trace signal summaries that did not consistently match a recurring theme in this
                  snapshot.
                </Txt>
                {noiseQuery.isPending && (
                  <Txt variant="body" tone="muted" className="mt-4">
                    Loading noise details…
                  </Txt>
                )}
                {noiseQuery.isError && (
                  <Txt variant="body" className="mt-4 text-error">
                    Unable to load noise details.
                  </Txt>
                )}
                {noiseQuery.data && (
                  <Txt variant="body" tone="ink" className="mt-4 tabular-nums">
                    {shareSentence(
                      filteredStats?.traceCount ?? noiseQuery.data.noise.traceCount,
                      filteredStats?.stageShare ?? noiseQuery.data.noise.coverage,
                    )}
                  </Txt>
                )}
              </section>

              <section aria-labelledby="noise-examples-heading">
                <Txt id="noise-examples-heading" as="h2" variant="column" tone="muted" className="uppercase">
                  Example summaries
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
                        No noise examples in this snapshot.
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
                    {noiseQuery.data && (
                      <ExamplesPager
                        traceCount={filteredStats?.traceCount ?? noiseQuery.data.noise.traceCount}
                        offset={examplesOffset}
                        onOffsetChange={offset => setExamplesPage({ contextKey: examplesContextKey, offset })}
                      />
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
