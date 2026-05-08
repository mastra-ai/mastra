import type { ElementType, ReactNode } from 'react';
import { ScrollArea } from '@/ds/components/ScrollArea/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

type Segment = { label: string; color: string };

type HorizontalBarRow = {
  name: string;
  values: number[];
  /** If present, the whole row is rendered as a link to this URL. */
  href?: string;
  /** If present, an individual segment becomes its own link. Indices align with `segments`. */
  hrefs?: Array<string | undefined>;
};

export function HorizontalBars({
  data,
  segments,
  maxVal,
  fmt,
  className,
  LinkComponent = 'a',
}: {
  data: Array<HorizontalBarRow>;
  segments: Segment[];
  maxVal: number;
  fmt: (v: number) => string;
  className?: string;
  /** Override how links produced by `href` / `hrefs` are rendered. Receives `href`,
   *  `className`, `aria-label`, and `children`. Defaults to a plain `<a>` element;
   *  consumers using a router should pass an adapter that maps `href` to their
   *  navigation primitive (e.g. react-router `<Link to={href} />`). */
  LinkComponent?: ElementType;
}) {
  const sorted = [...data].sort((a, b) => {
    const totalB = b.values.reduce((s, v) => s + v, 0);
    const totalA = a.values.reduce((s, v) => s + v, 0);
    return totalB - totalA;
  });

  const isStacked = segments.length > 1;

  return (
    <ScrollArea className={cn('w-full h-full', className)}>
      <div className="flex items-center gap-3 mb-4 mt-2">
        <div className="flex-1 flex items-center gap-4">
          {segments.map(seg => (
            <div key={seg.label} className="flex items-center gap-2">
              <div className="size-2 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-ui-sm text-neutral3">{seg.label}</span>
            </div>
          ))}
        </div>
        <span className="shrink-0 text-ui-sm text-neutral2 pr-2">Total</span>
      </div>
      <div className="grid gap-3.5">
        {sorted.map(d => {
          const total = d.values.reduce((s, v) => s + v, 0);
          const rowBody = (
            <>
              <div className="relative h-full flex-1 min-w-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn('absolute inset-y-0 left-0', d.href ? 'cursor-pointer' : 'cursor-default')}
                      style={{ width: `${maxVal > 0 ? (total / maxVal) * 100 : 0}%` }}
                    >
                      {segments.map((seg, si) => {
                        const val = d.values[si] ?? 0;
                        const pct = total > 0 ? (val / total) * 100 : 0;
                        const left = d.values.slice(0, si).reduce((s, v) => s + (total > 0 ? (v / total) * 100 : 0), 0);
                        const isLastWithValue = d.values.slice(si + 1).every(v => !v);
                        // Only honor segment-level links when the row itself is not an anchor.
                        // Otherwise we'd render <a> nested inside <a>, which is invalid HTML.
                        const segHref = d.href ? undefined : d.hrefs?.[si];

                        const segmentNode = (
                          <div
                            className={cn(
                              'absolute inset-y-0 opacity-40 dark:opacity-100',
                              isStacked && si === 0 && 'rounded-l',
                              isStacked && isLastWithValue && 'rounded-r',
                              !isStacked && 'rounded',
                              segHref && 'cursor-pointer hover:opacity-70 transition-opacity',
                            )}
                            style={{
                              left: isStacked ? `${left}%` : 0,
                              width: isStacked ? `${pct}%` : `${pct}%`,
                              backgroundColor: seg.color,
                            }}
                          />
                        );

                        if (segHref) {
                          return (
                            <LinkComponent
                              key={seg.label}
                              href={segHref}
                              aria-label={`${d.name} — ${seg.label}`}
                              className="contents"
                            >
                              {segmentNode}
                            </LinkComponent>
                          );
                        }
                        return <Wrapper key={seg.label}>{segmentNode}</Wrapper>;
                      })}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="font-mono">
                    <div className="grid gap-1">
                      {segments.map((seg, si) => (
                        <div key={seg.label} className="flex items-center gap-2">
                          <span>{seg.label}</span>
                          <span className="ml-auto pl-3">{fmt(d.values[si] ?? 0)}</span>
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
                <span className="absolute inset-y-0 left-2.5 flex items-center text-ui-sm text-neutral4 truncate z-10 pointer-events-none">
                  {d.name}
                </span>
              </div>
              <span className="text-ui-md text-neutral4 tabular-nums shrink-0 pr-3">{fmt(total)}</span>
            </>
          );

          if (d.href) {
            return (
              <LinkComponent
                key={d.name}
                href={d.href}
                className="flex items-center gap-14 h-6 rounded outline-none cursor-pointer hover:bg-surface3 focus-visible:bg-surface3 transition-colors"
              >
                {rowBody}
              </LinkComponent>
            );
          }
          return (
            <div key={d.name} className="flex items-center gap-14 h-6 ">
              {rowBody}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
