import { useId, useState } from 'react';

import { stageLabel } from '../stages';
import { momentLabel, type Shape, type TraceWindow } from '../traces';
import { pointIn, Swatch, TraceTooltip, type Point } from './TraceTooltip';

const BAND = 132;
/** Headroom above the peak, so the tallest sample is not flush with the ticks. */
const TOP_PAD = 16;

/**
 * How much the board was holding, stacked by stage. The rows below say what
 * happened to each card; this says how many were in the air at once.
 */
export function BoardOccupancy({ shape, window: traceWindow }: { shape: Shape; window: TraceWindow }) {
  const [cursor, setCursor] = useState<{ point: Point; index: number } | null>(null);
  const gradientId = useId();
  const { band } = shape;

  if (band.peak === 0) return null;

  const y = (value: number) => BAND - (value / band.peak) * (BAND - TOP_PAD);
  let floor = band.xs.map(() => 0);
  const areas = band.series.map(entry => {
    const top = floor.map((value, index) => value + entry.values[index]!);
    const crest = band.xs.map((x, index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y(top[index]!).toFixed(1)}`);
    const area = [
      ...crest,
      ...band.xs.map((x, index) => `L${x.toFixed(1)} ${y(floor[index]!).toFixed(1)}`).reverse(),
      'Z',
    ].join(' ');
    floor = top;
    return { ...entry, area, crest: crest.join(' ') };
  });

  const read = (point: Point) => {
    let index = 0;
    for (let candidate = 1; candidate < band.xs.length; candidate += 1) {
      if (Math.abs(band.xs[candidate]! - point.x) < Math.abs(band.xs[index]! - point.x)) index = candidate;
    }
    return { point, index };
  };

  const held = cursor ? band.series.filter(entry => entry.values[cursor.index]! > 0) : [];

  return (
    <div
      className="relative"
      onPointerMove={event => setCursor(read(pointIn(event)))}
      onPointerLeave={() => setCursor(null)}
    >
      <svg
        viewBox={`0 0 ${shape.width.toFixed(0)} ${BAND}`}
        role="img"
        aria-label={`Board occupancy over the last ${traceWindow.label}, peaking at ${band.peak} cards`}
        className="block h-auto w-full"
      >
        <defs>
          {areas.map(area => (
            <linearGradient key={area.stage} id={`${gradientId}-${area.stage}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={area.color} stopOpacity={0.85} />
              <stop offset="100%" stopColor={area.color} stopOpacity={0.28} />
            </linearGradient>
          ))}
        </defs>

        {shape.ticks.map(tick => (
          <line key={tick.x} x1={tick.x} y1={0} x2={tick.x} y2={BAND} className="stroke-border1" />
        ))}
        {areas.map(area => (
          <g
            key={area.stage}
            className={`transition-opacity duration-150 ${cursor && area.values[cursor.index] === 0 ? 'opacity-15' : ''}`}
          >
            <path d={area.area} fill={`url(#${gradientId}-${area.stage})`} />
            <path d={area.crest} fill="none" stroke={area.color} strokeWidth={1.25} strokeLinejoin="round" />
          </g>
        ))}
        <line x1={shape.nowX} y1={0} x2={shape.nowX} y2={BAND} className="stroke-positive1 opacity-60" />
        {cursor ? (
          <g className="pointer-events-none">
            <line
              x1={band.xs[cursor.index]}
              y1={0}
              x2={band.xs[cursor.index]}
              y2={BAND}
              className="stroke-icon4"
              strokeDasharray="3 3"
            />
            <circle
              cx={band.xs[cursor.index]}
              cy={y(band.totals[cursor.index]!)}
              r={3}
              className="fill-surface1 stroke-icon5"
            />
          </g>
        ) : null}
        <text x={shape.gutter - 12} y={11} textAnchor="end" className="fill-icon2 font-mono text-[9.5px]">
          {band.peak}
        </text>
        <text x={shape.gutter - 12} y={BAND - 2} textAnchor="end" className="fill-icon2 font-mono text-[9.5px]">
          0
        </text>
      </svg>

      {cursor ? (
        <TraceTooltip at={cursor.point} hostWidth={shape.width}>
          <span className="text-icon4 font-mono">{momentLabel(band.stamps[cursor.index]!)}</span>
          {held.length === 0 ? (
            <span className="text-icon3">Nothing in the pipeline</span>
          ) : (
            held.map(entry => (
              <span key={entry.stage} className="text-icon5 flex items-center gap-2">
                <Swatch fill={entry.fill} />
                <span className="flex-1">{stageLabel(entry.stage)}</span>
                <span className="font-mono tabular-nums">{entry.values[cursor.index]}</span>
              </span>
            ))
          )}
        </TraceTooltip>
      ) : null}
    </div>
  );
}
