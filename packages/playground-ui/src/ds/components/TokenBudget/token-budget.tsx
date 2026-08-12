import type { CSSProperties } from 'react';

import { formatCompactTokens } from './format-tokens';
import { toneClass } from './tones';
import type { TokenBudgetTone } from './tones';
import { cn } from '@/lib/utils';

import './token-budget.css';

interface DialStyle extends CSSProperties {
  '--token-budget-fill': number;
}

export interface TokenBudgetProps {
  tokens: number;
  threshold: number;
  /** What the budget is, spoken to assistive tech before its value. */
  label: string;
  tone?: TokenBudgetTone;
  /** Runs the highlight around the ring while something fills or drains the budget. */
  working?: boolean;
  className?: string;
}

/** A token budget as a ring, with its reading beside it. */
export function TokenBudget({
  tokens,
  threshold,
  label,
  tone = 'messages',
  working = false,
  className,
}: TokenBudgetProps) {
  const fill = threshold > 0 ? Math.min(100, Math.round((tokens / threshold) * 100)) : 0;
  const dialStyle: DialStyle = { '--token-budget-fill': fill };

  return (
    <span
      aria-label={label}
      aria-valuemax={threshold}
      aria-valuemin={0}
      aria-valuenow={tokens}
      aria-valuetext={`${formatCompactTokens(tokens)}/${formatCompactTokens(threshold)}k`}
      className={cn('inline-flex items-center gap-1.5 tabular-nums', toneClass[tone], className)}
      role="meter"
    >
      <span aria-hidden className="token-budget-dial" data-working={working || undefined} style={dialStyle} />
      <span className="text-icon4">
        {formatCompactTokens(tokens)}
        <span className="text-icon2">/{formatCompactTokens(threshold)}k</span>
      </span>
    </span>
  );
}
