import { formatCompactTokens } from '@/ds/components/TokenBudget/format-tokens';
import { toneClass } from '@/ds/components/TokenBudget/tones';
import type { TokenBudgetTone } from '@/ds/components/TokenBudget/tones';
import { cn } from '@/lib/utils';

interface ThreadContextProgressProps {
  messageTokens?: number;
  messageThreshold?: number;
  memoryTokens?: number;
  memoryThreshold?: number;
  /** Label for the second (memory-toned) bar. Defaults to "Memory". */
  memoryLabel?: string;
}

function ProgressBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: TokenBudgetTone;
}) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className={cn('min-w-0 flex-1', toneClass[tone])}>
      <div className="text-icon3 text-ui-xs mb-1 flex items-center justify-between gap-2 font-mono">
        <span className="text-icon6 tracking-wide uppercase">{label}</span>
        <span className="text-icon3 tabular-nums">
          {formatCompactTokens(value)}/{formatCompactTokens(max)}k
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-current/80" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function ThreadContextProgress({
  messageTokens,
  messageThreshold,
  memoryTokens,
  memoryThreshold,
  memoryLabel = 'Memory',
}: ThreadContextProgressProps) {
  const showMessages = messageTokens != null && messageThreshold != null && messageThreshold > 0;
  const showMemory = memoryTokens != null && memoryThreshold != null && memoryThreshold > 0;

  if (!showMessages && !showMemory) {
    return null;
  }

  return (
    <div className="border-border1 border-b px-3 py-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {showMessages ? (
          <ProgressBar label="Messages" value={messageTokens} max={messageThreshold} tone="messages" />
        ) : null}
        {showMemory ? (
          <ProgressBar label={memoryLabel} value={memoryTokens} max={memoryThreshold} tone="memory" />
        ) : null}
      </div>
    </div>
  );
}
