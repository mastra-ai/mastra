import * as React from 'react'
import Link from '@docusaurus/Link'
import { Input } from '@site/src/components/ui/input'
import { cn } from '@site/src/lib/utils'
import { Search as SearchIcon } from 'lucide-react'
import sidebar from '../../content/en/integrations/sidebars'
import styles from './integrations.module.css'

interface IntegrationItem {
  type: 'doc'
  id: string
  label: string
  customProps?: {
    icon?: string
    iconDark?: string
    customCSS?: string
  }
}

interface IntegrationCategory {
  type: 'category'
  label: string
  items: IntegrationItem[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isIntegrationItem(value: unknown): value is IntegrationItem {
  if (!isRecord(value) || value.type !== 'doc' || typeof value.id !== 'string' || typeof value.label !== 'string') {
    return false
  }

  if (value.customProps === undefined) {
    return true
  }

  return (
    isRecord(value.customProps) && (value.customProps.icon === undefined || typeof value.customProps.icon === 'string')
  )
}

function isIntegrationCategory(value: unknown): value is IntegrationCategory {
  return (
    isRecord(value) &&
    value.type === 'category' &&
    typeof value.label === 'string' &&
    Array.isArray(value.items) &&
    value.items.every(isIntegrationItem)
  )
}

const integrationCategories = Array.isArray(sidebar.integrationsSidebar)
  ? sidebar.integrationsSidebar.filter(isIntegrationCategory)
  : []

export default function IntegrationsPage() {
  const [query, setQuery] = React.useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredCategories = integrationCategories
    .map(category => ({
      ...category,
      items: category.items.filter(item => `${item.label} ${item.id}`.toLowerCase().includes(normalizedQuery)),
    }))
    .filter(category => category.items.length > 0)

  return (
    <div>
      <label className="relative mb-18 block" htmlFor="integration-search">
        <span className="sr-only">Search integrations</span>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--mastra-icons-1)"
        />
        <Input
          id="integration-search"
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search integrations..."
          autoComplete="off"
          className="h-10 rounded-md border-[0.5px] border-(--border) bg-(--mastra-surface-4) pr-3 pl-9 text-sm font-normal shadow-none placeholder:text-(--mastra-icons-2) focus-visible:border-(--mastra-green-accent-2) focus-visible:ring-2 focus-visible:ring-(--mastra-green-accent-2)/20"
        />
      </label>

      {filteredCategories.map(category => (
        <section key={category.label} className="mb-12">
          <h2>{category.label}</h2>
          <ul className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4', styles.list)}>
            {category.items.map(item => (
              <li key={item.id} className="mt-0!">
                <Link className="block h-full w-full no-underline!" to={`/integrations/${item.id}`}>
                  <div className="text-card-foreground flex h-full w-full cursor-pointer items-center gap-4 rounded-xl border border-(--border) bg-(--mastra-surface-1)/20 px-4 py-4 shadow-none transition-colors hover:bg-(--mastra-surface-1)/70 dark:border-(--border) dark:hover:bg-(--mastra-surface-2)">
                    {item.customProps?.icon ? (
                      item.customProps?.iconDark ? (
                        <>
                          <img
                            src={item.customProps.icon}
                            alt=""
                            loading="lazy"
                            className={cn(
                              'size-7 rounded-none! object-contain dark:hidden',
                              item.customProps.customCSS,
                            )}
                          />
                          <img
                            src={item.customProps.iconDark}
                            alt=""
                            loading="lazy"
                            className={cn(
                              'hidden size-7 rounded-none! object-contain dark:block',
                              item.customProps.customCSS,
                            )}
                          />
                        </>
                      ) : (
                        <img
                          src={item.customProps.icon}
                          alt=""
                          loading="lazy"
                          className={cn('size-7 rounded-none! object-contain', item.customProps?.customCSS)}
                        />
                      )
                    ) : null}
                    <span className="truncate">{item.label}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {filteredCategories.length === 0 ? (
        <p
          className="rounded-xl border border-dashed border-(--border) py-12 text-center text-(--mastra-text-secondary)"
          role="status"
        >
          No integrations match that search.
        </p>
      ) : null}
    </div>
  )
}
