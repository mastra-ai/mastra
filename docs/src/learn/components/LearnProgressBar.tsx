import { cn } from '@site/src/lib/utils'

type LearnProgressBarProps = {
  completed: number
  total: number
  className?: string
}

export function LearnProgressBar({ completed, total, className }: LearnProgressBarProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-(--mastra-surface-3)">
        <div className="h-full rounded-full bg-green-500 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs whitespace-nowrap text-(--mastra-text-tertiary)">
        {completed} of {total} completed
      </span>
    </div>
  )
}
