interface ThreadContextProgressProps {
  messageTokens?: number;
  messageThreshold?: number;
  memoryTokens?: number;
  memoryThreshold?: number;
}

function formatCompactTokens(value: number): string {
  if (value === 0) return '0';
  const k = value / 1000;
  const decimals = k < 0.1 ? 2 : 1;
  const formatted = k.toFixed(decimals);
  return formatted.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0$/, '$1');
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
      <div className="mb-1 flex items-center justify-between gap-2 font-mono text-ui-xs text-icon3">
        <span className="uppercase tracking-wide text-icon6">{label}</span>
        <span className="tabular-nums text-icon3">
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
        {showMemory ? <ProgressBar label="Memory" value={memoryTokens} max={memoryThreshold} tone="memory" /> : null}
      </div>
    </div>
  );
}
