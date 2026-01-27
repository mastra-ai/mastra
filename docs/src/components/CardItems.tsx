import React, { useState, useEffect } from 'react'
import Link from '@docusaurus/Link'
import { cn } from '@site/src/lib/utils'

const sluggify = (str: string) =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

interface CardItemsProps {
  titles: string[]
  items: Record<string, Array<{ title: string; href: string }>>
}

export function CardItems({ titles, items }: CardItemsProps) {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return sluggify(titles[0])
    const params = new URLSearchParams(window.location.search)
    return params.get('list') || sluggify(titles[0])
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('list', activeTab)
    window.history.replaceState({}, '', url.toString())
  }, [activeTab])

  const handleTabChange = (tab: string) => {
    setActiveTab(sluggify(tab))
  }

  const currentItems =
    items[titles.find(tab => sluggify(tab) === activeTab) ?? ''] ?? []

  return (
    <div className="card__grid">
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {titles.map(title => (
          <button
            onClick={() => handleTabChange(title)}
            key={title}
            className={cn(
              'w-fit rounded-full bg-(--mastra-surface-3) px-3 py-1 text-sm text-(--mastra-text-quaternary) capitalize transition-colors',
              activeTab === sluggify(title) &&
                'bg-(--mastra-text-primary) text-white dark:bg-gray-100 dark:text-black',
            )}
          >
            {title}
          </button>
        ))}
      </div>
      <div className="mt-6 grid w-full gap-3 md:grid-cols-2 lg:grid-cols-3">
        {currentItems.map(item => (
          <Link
            key={`${item.title}-${item.href}`}
            to={item.href}
            style={{
              textDecoration: 'none',
            }}
            className="group mb-0 min-w-0 rounded-[10px] border-[0.5px] border-(--border) bg-(--mastra-surface-3) p-2 px-4 text-center text-sm wrap-break-word transition-opacity hover:opacity-80 dark:border-[#343434]"
          >
            {item.title}
          </Link>
        ))}
      </div>
    </div>
  )
}
