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

import { useNoise, useNoiseExamples } from './hooks';
import type { TraceSignalName } from './types';

interface NoiseDetailPanelProps {
  entityId: string;
  entityType: string;
  snapshotId: string;
  signalName: TraceSignalName | undefined;
  onClose: () => void;
}

export function NoiseDetailPanel({ entityId, entityType, snapshotId, signalName, onClose }: NoiseDetailPanelProps) {
  const [examplesOffset, setExamplesOffset] = useState(0);
  const noiseQuery = useNoise(entityId, entityType, signalName, snapshotId);
  const examplesQuery = useNoiseExamples(entityId, entityType, signalName, snapshotId, 5, examplesOffset);

  return (
    <Drawer
      onOpenChange={open => {
        if (!open) onClose();
      }}
      open={signalName !== undefined}
      overlay="none"
      side="right"
      variant="floating"
    >
      <DrawerContent>
        <DrawerHeader className="border-border1 border-b">
          <DrawerTitle>Noise</DrawerTitle>
          <DrawerDescription className="sr-only">Noise details for the {signalName} signal</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="grid content-start gap-6 overflow-y-auto p-6">
          <section aria-labelledby="noise-summary-heading">
            <h2 id="noise-summary-heading" className="text-neutral3 font-mono text-xs tracking-wider uppercase">
              Summary
            </h2>
            <p className="text-neutral5 mt-3 text-sm">
              Noise contains signal summaries that did not consistently match a recurring theme in this snapshot.
            </p>
            {noiseQuery.isPending && <p className="text-neutral3 mt-4 text-sm">Loading noise details…</p>}
            {noiseQuery.isError && <p className="mt-4 text-sm text-red-500">Unable to load noise details.</p>}
            {noiseQuery.data && (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-neutral3">Traces</dt>
                  <dd className="text-neutral5 mt-1 font-mono">{noiseQuery.data.noise.traceCount}</dd>
                </div>
                <div>
                  <dt className="text-neutral3">Stage share</dt>
                  <dd className="text-neutral5 mt-1 font-mono">{Math.round(noiseQuery.data.noise.coverage * 100)}%</dd>
                </div>
              </dl>
            )}
          </section>

          <section aria-labelledby="noise-examples-heading">
            <h2 id="noise-examples-heading" className="text-neutral3 font-mono text-xs tracking-wider uppercase">
              Example summaries
            </h2>
            {examplesQuery.isPending && <p className="text-neutral3 mt-3 text-sm">Loading examples…</p>}
            {examplesQuery.isError && <p className="mt-3 text-sm text-red-500">Unable to load examples.</p>}
            {examplesQuery.data && (
              <>
                {examplesQuery.data.examples.length === 0 ? (
                  <p className="text-neutral3 mt-3 text-sm">No noise examples in this snapshot.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {examplesQuery.data.examples.map(example => (
                      <li
                        key={example.traceId}
                        className="border-border1 bg-surface3 text-neutral5 rounded-md border p-3 text-sm"
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
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
