import { type ReactNode, useState, useCallback } from 'react'
import Layout from '@theme/Layout'
import { cn } from '@site/src/lib/utils'
import { AnnouncementBanner } from '@site/src/components/AnnouncementBanner'
import { course } from '../course'
import { LearnStorageProvider, useSharedLearnStorage } from '../hooks/LearnStorageContext'
import { LearnSidebar } from './LearnSidebar'

type LearnLayoutProps = {
  children: ReactNode
  title?: string
  description?: string
  className?: string
}

function MobileToggle({ onToggle }: { onToggle: () => void }) {
  return (
    <div className="learn-mobile-toggle">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-(--mastra-text-secondary)"
        type="button"
        aria-label="Toggle course sidebar"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect
            x="1"
            y="7.5"
            width="14"
            height="1"
            rx="0.5"
            style={{ transformOrigin: 'center' }}
            className="translate-y-[-3.5px]"
          />
          <rect
            x="1"
            y="7.5"
            width="14"
            height="1"
            rx="0.5"
            style={{ transformOrigin: 'center' }}
            className="translate-y-[3.5px]"
          />
        </svg>
        Mastra Learn
      </button>
    </div>
  )
}

function LearnLayoutInner({ children, title, description, className }: LearnLayoutProps) {
  const { storage } = useSharedLearnStorage()
  const [mobileOpen, setMobileOpen] = useState(false)
  const toggleMobile = useCallback(() => setMobileOpen(prev => !prev), [])

  return (
    <Layout title={title ?? 'Learn'} description={description ?? course.description}>
      <div className="learn-layout-flex">
        <LearnSidebar
          lessons={course.lessons}
          storage={storage}
          mobileOpen={mobileOpen}
          onMobileToggle={toggleMobile}
        />
        <main className={cn('learn-main', className)}>
          <MobileToggle onToggle={toggleMobile} />
          <AnnouncementBanner />
          <div className="padding-top--md padding-bottom--lg container">
            <article className="learn-article">{children}</article>
          </div>
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
