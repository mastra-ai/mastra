import type { ReactNode } from 'react'
import Layout from '@theme/Layout'
import { cn } from '@site/src/lib/utils'

import ChatbotSidebar from '@site/src/theme/DocRoot/Layout/ChatbotSidebar'
import { course } from '../course'
import { LearnStorageProvider, useSharedLearnStorage } from '../hooks/LearnStorageContext'
import { LearnSidebar } from './LearnSidebar'
import { LearnMobileSidebar } from './LearnMobileSidebar'

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
      <LearnMobileSidebar lessons={course.lessons} storage={storage} />
      <div className="learn-layout-flex">
        <LearnSidebar lessons={course.lessons} storage={storage} />
        <main className={cn('learn-main', className)}>
          <div className="padding-top--md padding-bottom--lg container">
            <div className="row" id="doc-item-container">
              <article className="col">{children}</article>
              <div className="col col--3" />
            </div>
          </div>
        </main>
        <ChatbotSidebar />
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
