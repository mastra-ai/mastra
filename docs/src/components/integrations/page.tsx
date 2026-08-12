import * as React from 'react'
import { Input } from '@site/src/components/ui/input'
import { Search as SearchIcon } from 'lucide-react'
import { integrationCategories } from './data'
import { IntegrationItemsGrid } from './grid'

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
      <label data-llms-ignore className="relative mb-18 block" htmlFor="integration-search">
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
          <IntegrationItemsGrid items={category.items} columns={4} />
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
