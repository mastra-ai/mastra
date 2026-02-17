import Link from '@docusaurus/Link'
import { cn } from '@site/src/lib/utils'
import type { Lesson } from '../types'

type LessonNavProps = {
  prev?: Lesson
  next?: Lesson
  className?: string
}

export function LessonNav({ prev, next, className }: LessonNavProps) {
  return (
    <nav className={cn('flex items-center justify-between gap-4 py-6', className)}>
      {prev ? (
        <Link
          to={`/learn/${prev.slug}`}
          className="flex items-center gap-2 rounded-lg border border-(--border) px-4 py-2 text-sm text-(--mastra-text-secondary) no-underline transition-colors hover:border-(--mastra-green-accent-2) hover:text-(--mastra-text-primary)"
        >
          <span aria-hidden>←</span>
          <span>{prev.title}</span>
        </Link>
      ) : (
        <div />
      )}

      {next ? (
        <Link
          to={`/learn/${next.slug}`}
          className="flex items-center gap-2 rounded-lg border border-(--border) px-4 py-2 text-sm text-(--mastra-text-secondary) no-underline transition-colors hover:border-(--mastra-green-accent-2) hover:text-(--mastra-text-primary)"
        >
          <span>
            {next.title}
            {next.status === 'comingSoon' && (
              <span className="ml-1 text-xs text-(--mastra-text-tertiary)">(coming soon)</span>
            )}
          </span>
          <span aria-hidden>→</span>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  )
}
