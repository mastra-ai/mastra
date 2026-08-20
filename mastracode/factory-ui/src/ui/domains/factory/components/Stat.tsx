import type { ReactNode } from 'react';

/** Micro-caps, so a label reads as a field name and never competes with its figure. */
export const STAT_LABEL = 'text-icon2 font-mono text-[0.5625rem] tracking-[0.14em] uppercase';

/**
 * One figure as a widget: its name, the figure itself, and its shape over the
 * window painted behind and bled past the card, so a row of them reads as a
 * board of instruments rather than a table with charts stapled under it.
 */
export function Stat({
  label,
  value,
  detail,
  change,
  art,
  className,
}: {
  label: string;
  value: string;
  detail?: string;
  change?: ReactNode;
  /** Painted behind the figure, clipped by the card's own edge. */
  art?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-border1 bg-surface3 relative isolate flex h-full min-h-36 min-w-0 flex-col overflow-hidden rounded-xl border p-4 ${className ?? ''}`}
    >
      {art ? <div className="pointer-events-none absolute inset-0 -z-10">{art}</div> : null}
      <dt className={STAT_LABEL}>{label}</dt>
      <dd className="m-0 mt-3 flex min-w-0 flex-col">
        <span className="text-icon6 flex items-baseline gap-2 text-[2.25rem] leading-none font-medium tracking-[-0.04em] tabular-nums">
          {value}
          {change}
        </span>
        {detail ? <span className="text-ui-xs text-icon3 mt-2 truncate">{detail}</span> : null}
      </dd>
    </div>
  );
}
