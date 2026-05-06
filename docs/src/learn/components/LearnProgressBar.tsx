import { cn } from '@site/src/lib/utils'

type LearnProgressBarProps = {
  completed: number
  total: number
  className?: string
}

export function LearnProgressBar({ completed, total, className }: LearnProgressBarProps) {
  const pct = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-(--mastra-surface-3)">
        <div className="learn-progress-completed absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs whitespace-nowrap text-(--mastra-text-tertiary)">
        {completed} of {total} completed
      </span>
    </div>
  )
}
