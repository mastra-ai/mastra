import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

export interface ShareBarSlice {
  key: string;
  label: string;
  value: number;
  /** Background utility, e.g. `bg-chart-soft-1`. */
  color: string;
}

export function ShareBar({ slices, unit = 'item' }: { slices: ShareBarSlice[]; unit?: string }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) return null;

  const fade = (key: string) => (hovered !== null && hovered !== key ? 'opacity-25' : 'opacity-100');
  const share = (value: number) => Math.round((value / total) * 100);
  const amount = (value: number) => `${value} ${value === 1 ? unit : `${unit}s`}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-10 gap-1" onMouseLeave={() => setHovered(null)}>
        {slices.map(slice =>
          slice.value === 0 ? null : (
            <Tooltip key={slice.key}>
              <TooltipTrigger
                render={
                  <div
                    role="img"
                    tabIndex={0}
                    aria-label={`${slice.label}: ${amount(slice.value)}, ${share(slice.value)}%`}
                    style={{ flexGrow: slice.value }}
                    onMouseEnter={() => setHovered(slice.key)}
                    onFocus={() => setHovered(slice.key)}
                    onBlur={() => setHovered(null)}
                    className={`focus-visible:outline-accent1 h-full min-w-1 basis-0 rounded-lg transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 ${slice.color} ${fade(slice.key)}`}
                  />
                }
              />
              <TooltipContent>
                {slice.label} · {amount(slice.value)} · {share(slice.value)}%
              </TooltipContent>
            </Tooltip>
          ),
        )}
      </div>

      <ul className="m-0 grid list-none grid-cols-1 gap-x-4 gap-y-0.5 p-0 sm:grid-cols-2">
        {slices.map(slice => (
          <li
            key={slice.key}
            onMouseEnter={() => setHovered(slice.key)}
            onMouseLeave={() => setHovered(null)}
            className="group hover:bg-surface4 flex items-center gap-2.5 rounded-lg p-2 transition-colors"
          >
            <span
              aria-hidden="true"
              className={`h-7 w-[3px] shrink-0 rounded-full transition-opacity duration-200 ${slice.color} ${fade(slice.key)}`}
            />
            <span className="flex min-w-0 flex-col">
              <Txt as="span" variant="ui-xs" className="text-icon3 truncate">
                {slice.label}
              </Txt>
              <Txt as="span" variant="ui-sm" className="text-icon5 font-medium tabular-nums">
                {slice.value}
              </Txt>
            </span>
            <span className="bg-surface4 group-hover:bg-surface6 text-ui-xs text-icon4 ml-auto shrink-0 rounded-full px-2 py-0.5 tabular-nums transition-colors">
              {share(slice.value)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
