import type { CSSProperties } from 'react';

import { MetricValue } from '../MetricValue';
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
  /** What the budget is, spoken to assistive tech before its value. */
  label: string;
  tone?: TokenBudgetTone;
  /** Runs the highlight around the ring while something fills or drains the budget. */
  working?: boolean;
  /** Trailing note shown with the digits, e.g. the reduction a pending pass will bring. */
  hint?: string;
  className?: string;
}

/** A token budget as a ring: fill for how full it is, tone for which budget, digits on hover. */
export function TokenBudget({
  tokens,
  threshold,
  label,
  tone = 'messages',
  working = false,
  hint,
  className,
}: TokenBudgetProps) {
  const fill = threshold > 0 ? Math.min(100, Math.round((tokens / threshold) * 100)) : 0;
  const value = `${formatCompactTokens(tokens)}/${formatCompactTokens(threshold)}k`;
  const dialStyle: DialStyle = { '--token-budget-fill': fill };

  return (
    <span
      aria-label={label}
      aria-valuemax={threshold}
      aria-valuemin={0}
      aria-valuenow={tokens}
      aria-valuetext={value}
      className={cn('metric', toneClass[tone], className)}
      role="meter"
    >
      <span aria-hidden className="token-budget-dial" data-working={working || undefined} style={dialStyle} />
      <MetricValue className="text-icon3">
        {value}
        {hint && <span className="text-icon2 italic"> {hint}</span>}
      </MetricValue>
    </span>
  );
}
