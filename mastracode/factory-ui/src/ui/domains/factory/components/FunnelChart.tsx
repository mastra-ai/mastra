import { Txt } from '@mastra/playground-ui/components/Txt';
import { useId, useRef, useState } from 'react';

import { useHostWidth } from '../../../../hooks/useHostWidth';
import { ASSUMED_WIDTH, buildFunnel, type Band, type FunnelShape, type FunnelSource, type Label } from '../funnel';

/** How far the flow's own light spills past it. */
const HALO_BLUR = 9;

/**
 * A cohort as a ribbon: each stop is the share that got at least that far, so
 * the branch peeling off under a flow is what that stop held on to, and the
 * solid core of a flow is the share an agent closed.
 */
export function FunnelChart({ source, label }: { source: FunnelSource; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const width = useHostWidth(host, ASSUMED_WIDTH);
  const uid = useId();
  const shape = buildFunnel(width, source);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = [...shape.bands, ...shape.gates].find(part => part.key === openKey);
  // a stop reads across every flow, so only another flow pushes the rest back
  const heldFlow = shape.bands.some(band => band.key === openKey);
  const flow = (band: Band) => `url(#${uid}-flow-${band.key})`;
  const hover = (key: string) => ({
    onMouseEnter: () => setOpenKey(key),
    onMouseLeave: () => setOpenKey(current => (current === key ? null : current)),
    onFocus: () => setOpenKey(key),
    onBlur: () => setOpenKey(current => (current === key ? null : current)),
  });

  if (source.stops.every(stop => stop.reached === 0)) {
    return (
      <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
        {source.empty}
      </Txt>
    );
  }

  return (
    <div ref={host} className="relative flex flex-col gap-5">
      <svg
        viewBox={`0 0 ${shape.width.toFixed(0)} ${shape.height.toFixed(0)}`}
        role="group"
        aria-label={label}
        className="block h-auto w-full"
      >
        <FunnelPaints uid={uid} shape={shape} />

        {shape.gates.map(gate => (gate.tie ? <line key={gate.key} {...gate.tie} className="stroke-border1" /> : null))}

        {shape.arc ? (
          <g role="img" aria-label={shape.arc.described}>
            <title>{shape.arc.described}</title>
            <path
              d={shape.arc.path}
              fill="none"
              strokeWidth={1.25}
              strokeLinecap="round"
              strokeOpacity={0.55}
              markerEnd={`url(#${uid}-back)`}
              className="stroke-warning1"
            />
            <LabelText label={shape.arc.note} className="fill-warning1 text-[10px] opacity-70" />
          </g>
        ) : null}

        {/* the flow's own light, blurred underneath it */}
        <g filter={`url(#${uid}-halo)`} opacity={0.35} aria-hidden="true">
          {shape.bands.map(band => (
            <path key={band.key} d={band.core ?? band.carried} fill={flow(band)} />
          ))}
        </g>

        {shape.leaks.map(leak => (
          <g key={leak.key}>
            <path d={leak.path} className="fill-icon2" fillOpacity={0.16} />
            {leak.note ? <LabelText label={leak.note} className="fill-icon2 text-[10px]" /> : null}
          </g>
        ))}

        {shape.bands.map(band => (
          <g
            key={band.key}
            role="img"
            tabIndex={0}
            aria-label={band.described}
            {...hover(band.key)}
            className="focus-visible:outline-accent1 cursor-default transition-opacity duration-150 focus-visible:outline-2"
            opacity={!heldFlow || openKey === band.key ? 1 : 0.3}
          >
            <path d={band.carried} fill={flow(band)} fillOpacity={shape.coreLegend === null ? 0.92 : 0.26} />
            {band.core ? <path d={band.core} fill={flow(band)} /> : null}
            <path d={band.edge} fill="none" stroke={flow(band)} strokeWidth={1.5} strokeOpacity={0.85} />
          </g>
        ))}

        {shape.dwellCaption ? (
          <LabelText
            label={shape.dwellCaption}
            className="fill-icon2 font-mono text-[8.5px] tracking-[0.12em] uppercase opacity-70"
          />
        ) : null}
        {shape.bands.map(band =>
          band.dwell ? (
            <LabelText
              key={band.key}
              label={band.dwell}
              className={`font-mono text-[10px] tabular-nums ${band.slowest ? 'fill-icon4' : 'fill-icon2'}`}
            />
          ) : null,
        )}

        {shape.gates.map(gate => (
          <g
            key={gate.key}
            role="img"
            tabIndex={0}
            aria-label={gate.described}
            {...hover(gate.key)}
            className="focus-visible:outline-accent1 cursor-default focus-visible:outline-2"
          >
            {gate.cap ? <rect {...gate.cap} /> : null}
            <LabelText label={gate.name} className="fill-icon2 font-mono text-[9px] tracking-[0.14em] uppercase" />
            <LabelText
              label={gate.count}
              className={`text-[20px] font-medium tracking-[-0.03em] tabular-nums transition-colors duration-100 ${openKey === gate.key ? 'fill-accent1' : 'fill-icon6'}`}
            />
          </g>
        ))}
      </svg>

      {shape.coreLegend || shape.sentBack ? (
        <div className="text-ui-xs text-icon3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {shape.coreLegend ? (
            <span className="flex items-center gap-1.5">
              <svg width={14} height={10} aria-hidden="true" className="shrink-0">
                <rect x={0} y={0} width={14} height={4.5} rx={2.25} className="fill-chart-trend" />
                <rect x={0} y={5.5} width={14} height={4.5} rx={2.25} className="fill-chart-trend" opacity={0.2} />
              </svg>
              {shape.coreLegend}
            </span>
          ) : null}
          {shape.sentBack ? <span className="ml-auto">{shape.sentBack}</span> : null}
        </div>
      ) : null}

      {open ? (
        <div
          role="presentation"
          className="border-border1 bg-surface2/95 text-ui-xs text-icon4 pointer-events-none absolute z-10 flex -translate-x-1/2 flex-col gap-1 rounded-lg border px-3 py-2 shadow-lg backdrop-blur-sm"
          style={{
            left: `${(open.anchor.x / shape.width) * 100}%`,
            top: `${(open.anchor.y / shape.height) * 100}%`,
          }}
        >
          {open.detail.map(line => (
            <span key={line}>{line}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Gradients along each flow, the blur its halo rides on, and the send-back arrowhead. */
function FunnelPaints({ uid, shape }: { uid: string; shape: FunnelShape }) {
  return (
    <defs>
      <filter id={`${uid}-halo`} x="-15%" y="-50%" width="130%" height="200%">
        <feGaussianBlur stdDeviation={HALO_BLUR} />
      </filter>
      <marker
        id={`${uid}-back`}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="10"
        markerHeight="10"
        markerUnits="userSpaceOnUse"
        orient="auto"
      >
        <path
          d="M9 2 L3.5 5 L9 8"
          fill="none"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-warning1"
        />
      </marker>
      {shape.bands.map(band => (
        <linearGradient key={band.key} id={`${uid}-flow-${band.key}`} gradientUnits="userSpaceOnUse" {...band.axis}>
          <stop offset="0%" stopColor={band.from} />
          <stop offset="100%" stopColor={band.to} />
        </linearGradient>
      ))}
    </defs>
  );
}

function LabelText({ label, className }: { label: Label; className: string }) {
  return (
    <text x={label.x.toFixed(1)} y={label.y.toFixed(1)} textAnchor={label.anchor} className={className}>
      {label.text}
    </text>
  );
}
