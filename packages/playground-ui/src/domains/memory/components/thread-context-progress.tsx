import { formatCompactTokens } from './thread-context-progress-utils';

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
  tone: 'message' | 'memory';
}) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  const toneClass = tone === 'message' ? 'bg-blue-500/80' : 'bg-violet-500/80';

  return (
    <div className="min-w-0 flex-1">
      <div className="text-icon3 mb-1 flex items-center justify-between gap-2 font-mono text-ui-xs">
        <span className="text-icon6 tracking-wide uppercase">{label}</span>
        <span className="text-icon3 tabular-nums">
          {formatCompactTokens(value)}/{formatCompactTokens(max)}k
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${percent}%` }} />
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
  const showMessages = messageTokens != null && messageThreshold != null;
  const showMemory = memoryTokens != null && memoryThreshold != null;

  if (!showMessages && !showMemory) {
    return null;
  }

  return (
    <div className="border-b border-border1 px-3 py-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {showMessages ? (
          <ProgressBar label="Messages" value={messageTokens} max={messageThreshold} tone="message" />
        ) : null}
        {showMemory ? (
          <ProgressBar label={memoryLabel} value={memoryTokens} max={memoryThreshold} tone="memory" />
        ) : null}
      </div>
    </div>
  );
}
