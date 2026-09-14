import { useId } from 'react';

import { formatCompactTokens } from './format-tokens';
import { toneClass } from './tones';
import type { TokenBudgetTone } from './tones';
import { cn } from '@/lib/utils';

import './token-budget.css';

const RADIUS = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface TokenBudgetProps {
  tokens: number;
  threshold: number;
  /** What the budget is, spoken to assistive tech before its value. */
  label: string;
  tone?: TokenBudgetTone;
  /** Runs the light around the ring while something fills or drains the budget. */
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
  const id = useId();
  const fill = threshold > 0 ? Math.min(100, Math.round((tokens / threshold) * 100)) : 0;
  const wedge = `${((CIRCUMFERENCE * fill) / 100).toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`;

  return (
    <span
      aria-label={label}
      aria-valuemax={threshold}
      aria-valuemin={0}
      aria-valuenow={Math.min(tokens, threshold)}
      aria-valuetext={`${formatCompactTokens(tokens)}/${formatCompactTokens(threshold)}k`}
      className={cn('inline-flex items-center gap-1.5 tabular-nums', toneClass[tone], className)}
      role="meter"
    >
      <svg aria-hidden className="token-budget-dial" data-working={working || undefined} viewBox="0 0 20 20">
        <circle className="token-budget-track" cx="10" cy="10" r={RADIUS} strokeWidth="3" />
        {working ? (
          <>
            <defs>
              <linearGradient id={`${id}-sheen`}>
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
                <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.25" />
              </linearGradient>
              <mask id={`${id}-wedge`}>
                <circle
                  className="token-budget-arc"
                  cx="10"
                  cy="10"
                  r={RADIUS}
                  stroke="white"
                  strokeDasharray={wedge}
                  strokeWidth="3"
                />
              </mask>
            </defs>
            <g mask={`url(#${id}-wedge)`}>
              <rect className="token-budget-sheen" fill={`url(#${id}-sheen)`} height="20" width="20" x="0" y="0" />
            </g>
          </>
        ) : (
          <circle
            className="token-budget-arc"
            cx="10"
            cy="10"
            r={RADIUS}
            stroke="currentColor"
            strokeDasharray={wedge}
            strokeWidth="3"
          />
        )}
      </svg>
      <span className="text-icon4">
        {formatCompactTokens(tokens)}
        <span className="text-icon2">/{formatCompactTokens(threshold)}k</span>
      </span>
    </span>
  );
}
