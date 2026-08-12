import { formatCompactTokens } from './format-tokens';
import { toneClass } from './tones';
import type { TokenBudgetTone } from './tones';
import { cn } from '@/lib/utils';

export interface TokenBudgetDetailProps {
  tokens: number;
  threshold: number;
  label: string;
  /** What happens when the budget fills. */
  description?: string;
  /** Note about pending work, e.g. what the next pass will free. */
  hint?: string;
  tone?: TokenBudgetTone;
}

/** The full reading behind a `TokenBudget` ring: how full, in figures, and what filling it up does. */
export function TokenBudgetDetail({
  tokens,
  threshold,
  label,
  description,
  hint,
  tone = 'messages',
}: TokenBudgetDetailProps) {
  const fill = threshold > 0 ? Math.min(100, Math.round((tokens / threshold) * 100)) : 0;

  return (
    <div className={cn('flex flex-col gap-1.5', toneClass[tone])}>
      <p className="text-ui-sm text-icon5 flex items-baseline justify-between gap-3">
        {label}
        <span className="text-ui-xs text-icon3 tabular-nums">
          {formatCompactTokens(tokens)}/{formatCompactTokens(threshold)}k
        </span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-current/15">
        <div className="h-full rounded-full bg-current" style={{ width: `${fill}%` }} />
      </div>
      {description && <p className="text-ui-xs text-icon2">{description}</p>}
      {hint && <p className="text-ui-xs text-icon3">{hint}</p>}
    </div>
  );
}
