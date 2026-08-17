import type { ReactNode } from 'react';

import { formatCompactTokens } from './format-tokens';
import { toneClass } from './tones';
import type { TokenBudgetTone } from './tones';
import { cn } from '@/lib/utils';

import './token-budget.css';

export interface TokenBudgetDetailProps {
  /** Short name of the budget, e.g. "Messages". */
  label: string;
  tokens: number;
  threshold: number;
  /** Tokens a pending pass will free, hatched at the end of the fill. */
  projected?: number;
  /** What filling it up sets off, in a few words. */
  description?: string;
  tone?: TokenBudgetTone;
  /** Sits before the label in the budget's own color, tying the row to its ring. */
  icon?: ReactNode;
}

/** A budget in full: how far it has filled, and what reaching the threshold sets off. */
export function TokenBudgetDetail({
  label,
  tokens,
  threshold,
  projected = 0,
  description,
  tone = 'messages',
  icon,
}: TokenBudgetDetailProps) {
  const used = threshold > 0 ? Math.min(100, (tokens / threshold) * 100) : 0;
  const freed = Math.min(used, threshold > 0 ? (projected / threshold) * 100 : 0);

  return (
    <div className={cn('flex flex-col gap-1.5', toneClass[tone])}>
      <p className="text-ui-xs flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5">
          {icon && (
            <span aria-hidden className="[&_svg]:size-3.5">
              {icon}
            </span>
          )}
          <span className="text-icon5">{label}</span>
        </span>
        <span className="text-icon4 tabular-nums">
          {formatCompactTokens(tokens)}
          <span className="text-icon2">/{formatCompactTokens(threshold)}k</span>
          {projected > 0 && <span className="text-icon2"> −{formatCompactTokens(projected)}k</span>}
        </span>
      </p>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-current/15">
        <div className="bg-current" style={{ width: `${used - freed}%` }} />
        <div className="token-budget-hatch" style={{ width: `${freed}%` }} />
      </div>
      {description && <p className="text-icon2 text-ui-xs">{description}</p>}
    </div>
  );
}
