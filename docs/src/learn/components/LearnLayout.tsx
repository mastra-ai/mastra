import type { ReactNode } from 'react'
import Layout from '@theme/Layout'
import { cn } from '@site/src/lib/utils'
import { course } from '../course'
import { useLearnStorage } from '../hooks/useLearnStorage'
import { LearnSidebar } from './LearnSidebar'

type LearnLayoutProps = {
  children: ReactNode
  title?: string
  description?: string
  className?: string
}

export function LearnLayout({ children, title, description, className }: LearnLayoutProps) {
  const { storage, updateLesson, setLastVisited } = useLearnStorage()

  return (
    <Layout title={title ?? 'Learn'} description={description ?? course.description}>
      <div className="flex min-h-[calc(100vh-var(--ifm-navbar-height))]">
        <LearnSidebar lessons={course.lessons} storage={storage} />
        <main className={cn('flex-1 overflow-x-hidden px-6 py-8 lg:px-12', className)}>
          <div className="mx-auto max-w-3xl">
            {typeof children === 'function'
              ? (
                  children as (props: {
                    storage: typeof storage
                    updateLesson: typeof updateLesson
                    setLastVisited: typeof setLastVisited
                  }) => ReactNode
                )({ storage, updateLesson, setLastVisited })
              : children}
          </div>
        </main>
      </div>
    </Layout>
  )
}
