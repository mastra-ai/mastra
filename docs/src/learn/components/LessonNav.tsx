import Link from '@docusaurus/Link'
import { cn } from '@site/src/lib/utils'
import type { Lesson } from '../types'

type LessonNavProps = {
  prev?: Lesson
  next?: Lesson
  className?: string
}

export function LessonNav({ prev, next, className }: LessonNavProps) {
  const prevPublished = prev && prev.status === 'published'
  const nextPublished = next && next.status === 'published'

  return (
    <nav className={cn('learn-lesson-nav', className)}>
      {prev ? (
        prevPublished ? (
          <Link
            to={`/learn/${prev.slug}`}
            className="learn-link flex items-center gap-2 rounded-lg border border-(--border) px-4 py-2 text-sm text-(--mastra-text-secondary) transition-colors hover:border-(--mastra-green-accent-3) hover:text-(--mastra-text-primary)"
          >
            <span aria-hidden>←</span>
            <span>{prev.title}</span>
          </Link>
        ) : (
          <span className="flex items-center gap-2 rounded-lg border border-(--border) px-4 py-2 text-sm text-(--mastra-text-muted) opacity-60">
            <span aria-hidden>←</span>
            <span>
              {prev.title}
              <span className="ml-1 text-xs">(Coming Early March 2026)</span>
            </span>
          </span>
        )
      ) : (
        <div />
      )}

      {next ? (
        nextPublished ? (
          <Link
            to={`/learn/${next.slug}`}
            className="learn-link flex items-center gap-2 rounded-lg border border-(--border) px-4 py-2 text-sm text-(--mastra-text-secondary) transition-colors hover:border-(--mastra-green-accent-3) hover:text-(--mastra-text-primary)"
          >
            <span>{next.title}</span>
            <span aria-hidden>→</span>
          </Link>
        ) : (
          <span className="flex items-center gap-2 rounded-lg border border-(--border) px-4 py-2 text-sm text-(--mastra-text-muted) opacity-60">
            <span>
              {next.title}
              <span className="ml-1 text-xs">(Coming Early March 2026)</span>
            </span>
            <span aria-hidden>→</span>
          </span>
        )
      ) : (
        <div />
      )}
    </nav>
  )
}
