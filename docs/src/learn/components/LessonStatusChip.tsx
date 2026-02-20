import { cn } from '@site/src/lib/utils'
import type { LessonStatus } from '../types'

export function LessonStatusChip({ status, className }: { status: LessonStatus; className?: string }) {
  if (status === 'published') return null

  return (
    <span
      className={cn(
        'learn-status-coming-soon inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
    >
      Coming Early March 2026
    </span>
  )
}
