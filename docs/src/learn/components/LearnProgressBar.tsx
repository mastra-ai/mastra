import { cn } from '@site/src/lib/utils'

type LearnProgressBarProps = {
  completed: number
  total: number
  totalLessons: number
  className?: string
}

export function LearnProgressBar({ completed, total, totalLessons, className }: LearnProgressBarProps) {
  const publishedPct = totalLessons > 0 ? (total / totalLessons) * 100 : 0
  const completedPct = totalLessons > 0 ? (completed / totalLessons) * 100 : 0

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-(--mastra-surface-3)">
        {/* Available (published) segment */}
        <div className="absolute inset-y-0 left-0 rounded-full bg-(--border)" style={{ width: `${publishedPct}%` }} />
        {/* Completed segment */}
        <div className="absolute inset-y-0 left-0 rounded-full bg-green-500" style={{ width: `${completedPct}%` }} />
      </div>
      <span className="text-xs whitespace-nowrap text-(--mastra-text-tertiary)">
        {completed} of {total} completed · {totalLessons - total} coming soon
      </span>
    </div>
  )
}
