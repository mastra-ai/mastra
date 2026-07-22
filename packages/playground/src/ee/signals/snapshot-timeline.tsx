import { Button } from '@mastra/playground-ui/components/Button';
import { Slider } from '@mastra/playground-ui/components/Slider';
import { Pause, Play } from 'lucide-react';

import { formatSnapshotWindow, traceLabel } from './signal-formatting';
import type { ThemeSnapshot } from './types';

export function SnapshotTimeline({
  snapshots,
  selectedIndex,
  isPlaying,
  onPlayingChange,
  onSnapshotChange,
}: {
  snapshots: ThemeSnapshot[];
  selectedIndex: number;
  isPlaying: boolean;
  onPlayingChange: (isPlaying: boolean) => void;
  onSnapshotChange: (index: number) => void;
}) {
  const snapshot = snapshots[selectedIndex];

  if (!snapshot) return null;

  return (
    <section
      aria-label="Snapshot timeline"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border1 bg-surface2 px-3 py-2.5 sm:px-4"
    >
      {snapshots.length > 1 ? (
        <>
          <Button
            aria-label={isPlaying ? 'Pause snapshots' : 'Play snapshots'}
            onClick={() => onPlayingChange(!isPlaying)}
            size="sm"
            type="button"
            variant="outline"
          >
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Slider
            aria-label="Snapshot"
            className="min-w-32 flex-1"
            max={snapshots.length - 1}
            min={0}
            onValueChange={(value: number[]) => onSnapshotChange(value[0] ?? 0)}
            step={1}
            value={[selectedIndex]}
          />
        </>
      ) : null}
      <p
        aria-live="polite"
        className="w-full text-left font-mono text-xs tabular-nums text-neutral4 md:ml-auto md:w-auto md:min-w-72 md:text-right"
      >
        Snapshot {snapshot.ordinal}/{snapshot.total} · {formatSnapshotWindow(snapshot.startedAt, snapshot.endedAt)} ·{' '}
        {traceLabel(snapshot.traceCount)}
      </p>
    </section>
  );
}
