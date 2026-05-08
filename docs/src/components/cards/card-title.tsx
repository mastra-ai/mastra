import { cn } from '@site/src/lib/utils'
import { sluggify } from './card-items-inner'

export function CardTitle({
  titles,
  activeTab,
  setActiveTab,
}: {
  titles: string[]
  activeTab: string
  setActiveTab: (tab: string) => void
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      {titles.map(title => (
        <button
          onClick={() => setActiveTab(title)}
          key={title}
          className={cn(
            'w-fit rounded-full bg-[var(--light-color-surface-3)] px-3 py-1 text-sm text-[var(--light-color-text-4)] capitalize dark:bg-[#121212] dark:text-[var(--color-el-3)]',
            activeTab === sluggify(title) &&
              'bg-[var(--light-color-text-6)] text-white dark:bg-gray-100 dark:text-black',
          )}
        >
          {title}
        </button>
      ))}
    </div>
  )
}
