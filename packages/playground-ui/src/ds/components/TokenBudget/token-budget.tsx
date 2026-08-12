import type { CSSProperties } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '../Popover';
import { formatCompactTokens } from './format-tokens';
import { cn } from '@/lib/utils';

import './token-budget.css';

const toneClass = {
  messages: 'text-blue-500',
  memory: 'text-violet-500',
  warning: 'text-warning1',
} as const;

export type TokenBudgetTone = keyof typeof toneClass;

interface DialStyle extends CSSProperties {
  '--token-budget-fill': number;
}

export interface TokenBudgetProps {
  tokens: number;
  threshold: number;
  /** What the budget is, spoken to assistive tech and titling its detail popover. */
  label: string;
  /** What happens when the budget fills, shown in the detail popover. */
  description?: string;
  tone?: TokenBudgetTone;
  /** Runs the highlight around the ring while something fills or drains the budget. */
  working?: boolean;
  /** Trailing note shown with the digits, e.g. the reduction a pending pass will bring. */
  hint?: string;
  className?: string;
}

/** A token budget as a ring, with its digits beside it and the full reading one click away. */
export function TokenBudget({
  tokens,
  threshold,
  label,
  description,
  tone = 'messages',
  working = false,
  hint,
  className,
}: TokenBudgetProps) {
  const fill = threshold > 0 ? Math.min(100, Math.round((tokens / threshold) * 100)) : 0;
  const value = `${formatCompactTokens(tokens)}/${formatCompactTokens(threshold)}k`;
  const dialStyle: DialStyle = { '--token-budget-fill': fill };

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'focus-visible:outline-accent1 inline-flex items-center rounded-sm tabular-nums hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2',
          toneClass[tone],
          className,
        )}
      >
        <span
          aria-label={label}
          aria-valuemax={threshold}
          aria-valuemin={0}
          aria-valuenow={tokens}
          aria-valuetext={value}
          className="inline-flex items-center"
          role="meter"
        >
          <span aria-hidden className="token-budget-dial" data-working={working || undefined} style={dialStyle} />
          <span className="text-icon3 ps-1">
            {formatCompactTokens(tokens)}
            <span className="text-icon2">/{formatCompactTokens(threshold)}k</span>
          </span>
        </span>
        {hint && <span className="text-icon2 ps-1 italic">{hint}</span>}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn('flex flex-col gap-2', toneClass[tone])} side="top">
        <p className="text-ui-sm text-icon5">{label}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-current/15">
          <div className="h-full rounded-full bg-current" style={{ width: `${fill}%` }} />
        </div>
        <p className="text-ui-xs text-icon3 tabular-nums">
          {value} tokens · {fill}%
        </p>
        {description && <p className="text-ui-xs text-icon2">{description}</p>}
      </PopoverContent>
    </Popover>
  );
}
