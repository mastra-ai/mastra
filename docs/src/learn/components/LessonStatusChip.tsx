import { cn } from '@site/src/lib/utils'
import type { LessonStatus } from '../types'

export function LessonStatusChip({ status, className }: { status: LessonStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        status === 'published' ? 'learn-status-published' : 'learn-status-coming-soon',
        className,
      )}
    >
      {status === 'published' ? 'Published' : 'Coming Soon'}
    </span>
  )
}
