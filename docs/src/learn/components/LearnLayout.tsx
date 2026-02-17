import type { ReactNode } from 'react'
import Layout from '@theme/Layout'
import { cn } from '@site/src/lib/utils'
import { course } from '../course'
import { LearnStorageProvider, useSharedLearnStorage } from '../hooks/LearnStorageContext'
import { LearnSidebar } from './LearnSidebar'

type LearnLayoutProps = {
  children: ReactNode
  title?: string
  description?: string
  className?: string
}

function LearnLayoutInner({ children, title, description, className }: LearnLayoutProps) {
  const { storage } = useSharedLearnStorage()

  return (
    <Layout title={title ?? 'Learn'} description={description ?? course.description}>
      <div className="flex min-h-[calc(100vh-var(--ifm-navbar-height))]">
        <LearnSidebar lessons={course.lessons} storage={storage} />
        <main className={cn('flex-1 overflow-x-hidden px-6 py-8 lg:px-12', className)}>
          <div className="mx-auto max-w-3xl">{children}</div>
        </main>
      </div>
    </Layout>
  )
}

export function LearnLayout(props: LearnLayoutProps) {
  return (
    <LearnStorageProvider>
      <LearnLayoutInner {...props} />
    </LearnStorageProvider>
  )
}
