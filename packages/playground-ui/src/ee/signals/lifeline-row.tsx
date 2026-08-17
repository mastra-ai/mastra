import { LifelinePoint } from './lifeline-point';
import { formatSnapshotCutoff } from './signal-formatting';
import type { ThemeSelection } from './theme-drilldown-data';
import { lifelineConnectors, lifelineSegments } from './theme-lifelines-data';
import type { ThemeLifeline, ThemeLifelinePoint } from './theme-lifelines-data';
import type { ThemeSnapshot, TraceSignalName } from './types';
import { nodeColor } from '@/ds/components/SankeyChart';

const TRACK_HEIGHT = 28;
const MAX_BAR_HEIGHT = 22;
const MIN_BAR_HEIGHT = 4;

function barHeight(share: number) {
  return Math.max(MIN_BAR_HEIGHT, Math.round(share * MAX_BAR_HEIGHT));
}

function pointTitle(snapshot: ThemeSnapshot | undefined, label: string, traceCount: number, share: number) {
  const cutoff = snapshot?.cutoffAt ? formatSnapshotCutoff(snapshot.cutoffAt) : undefined;
  return `${label}${cutoff ? ` · ${cutoff}` : ''} · ${traceCount} traces (${Math.round(share * 100)}%)`;
}

function lifelineArea(segment: ThemeLifelinePoint[], positions: number[]) {
  const firstPoint = segment[0];
  const lastPoint = segment.at(-1);
  if (!firstPoint || !lastPoint) return undefined;

  return {
    key: firstPoint.snapshotIndex,
    points: [
      `${positions[firstPoint.snapshotIndex]},${TRACK_HEIGHT - 1}`,
      ...segment.map(point => `${positions[point.snapshotIndex]},${TRACK_HEIGHT - 1 - barHeight(point.share)}`),
      `${positions[lastPoint.snapshotIndex]},${TRACK_HEIGHT - 1}`,
    ].join(' '),
  };
}

export function LifelineRow({
  row,
  signalName,
  snapshots,
  positions,
  hue,
  onThemeSelect,
}: {
  row: ThemeLifeline;
  signalName: TraceSignalName;
  snapshots: ThemeSnapshot[];
  positions: number[];
  hue: number;
  onThemeSelect: (selection: ThemeSelection, snapshotIndex: number) => void;
}) {
  const isPersistent = row.points.length * 2 >= snapshots.length;
  const connectors = lifelineConnectors(row.points);
  const segments = lifelineSegments(row.points);
  const pointY = (point: ThemeLifelinePoint) => TRACK_HEIGHT - 1 - barHeight(point.share);

  return (
    <li
      aria-label={`${row.label}: present in ${row.points.length} of ${snapshots.length} landmarks`}
      className={`group hover:bg-surface3 flex items-center gap-3 rounded-md transition-colors ${isPersistent ? '' : 'opacity-55 hover:opacity-100'}`}
    >
      <span
        className="text-neutral4 group-hover:text-neutral6 w-52 shrink-0 truncate text-right text-xs"
        title={row.label}
      >
        {row.label}
      </span>
      <div className="border-border1 relative mx-2 h-7 min-w-0 flex-1 border-b">
        {connectors.length > 0 || segments.length > 0 ? (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full"
            preserveAspectRatio="none"
            viewBox={`0 0 100 ${TRACK_HEIGHT}`}
          >
            {segments.map(segment => {
              const area = lifelineArea(segment, positions);
              if (!area) return undefined;
              return <polygon key={`area-${area.key}`} fill={nodeColor(hue)} fillOpacity={0.14} points={area.points} />;
            })}
            {connectors.map(({ from, to }) => (
              <line
                key={`${from.snapshotIndex}-${to.snapshotIndex}`}
                stroke={nodeColor(hue)}
                strokeOpacity={0.45}
                strokeWidth={1.2}
                vectorEffect="non-scaling-stroke"
                x1={positions[from.snapshotIndex]}
                y1={pointY(from)}
                x2={positions[to.snapshotIndex]}
                y2={pointY(to)}
              />
            ))}
          </svg>
        ) : null}
        {row.points.map(point => {
          const title = pointTitle(snapshots[point.snapshotIndex], row.label, point.traceCount, point.share);
          const themeId = point.themeId;
          return (
            <LifelinePoint
              key={point.snapshotIndex}
              title={title}
              positionPercent={positions[point.snapshotIndex]}
              height={barHeight(point.share)}
              color={nodeColor(hue)}
              onSelect={
                themeId === undefined
                  ? undefined
                  : () => onThemeSelect({ signalName, themeId, label: row.label }, point.snapshotIndex)
              }
            />
          );
        })}
      </div>
      <span className="text-neutral3 w-9 shrink-0 font-mono text-[11px] tabular-nums">
        {row.points.length}/{snapshots.length}
      </span>
    </li>
  );
}
