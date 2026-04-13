import { useEffect, useRef } from 'react'
import { cn } from '@site/src/lib/utils'

export const searches = [
  {
    label: 'Quickstart',
    description: 'Get up and running with Mastra',
    link: '/guides/getting-started/quickstart',
  },
  {
    label: 'Studio',
    description: 'Test your agents, workflows, and tools',
    link: '/docs/studio/overview',
  },
  {
    label: 'Agents',
    description: 'Use LLMs and tools to solve open-ended tasks',
    link: '/docs/agents/overview',
  },
  {
    label: 'Memory',
    description: 'Manage agent context across conversations',
    link: '/docs/memory/overview',
  },
  {
    label: 'Workflows',
    description: 'Define and manage complex sequences of tasks',
    link: '/docs/workflows/overview',
  },
  {
    label: 'Streaming',
    description: 'Streaming for real-time agent interactions',
    link: '/docs/streaming/overview',
  },
  {
    label: 'MCP',
    description: 'Connect agents to external tools and resources',
    link: '/docs/mcp/overview',
  },
  {
    label: 'Evals',
    description: 'Evaluate agent performance',
    link: '/docs/evals/overview',
  },
  {
    label: 'Observability',
    description: 'Monitor and log agent activity',
    link: '/docs/observability/overview',
  },
  {
    label: 'Deployment',
    description: 'Deploy your agents, workflows, and tools',
    link: '/docs/deployment/overview',
  },
]

export function EmptySearch({
  selectedIndex,
  onSelect,
  onHover,
}: {
  selectedIndex: number
  onSelect: (index: number) => void
  onHover: (index: number) => void
}) {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  // Scroll selected item into view when navigating with keyboard
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [selectedIndex])

  return (
    <div className="flex flex-col gap-1">
      {searches.map((search, index) => {
        const isSelected = selectedIndex === index
        return (
          <div
            key={search.link}
            ref={el => {
              itemRefs.current[index] = el
            }}
            className={cn(
              'flex cursor-pointer flex-col gap-1 rounded-md p-2',
              isSelected
                ? 'bg-(--mastra-surface-2) dark:bg-(--mastra-surface-5)'
                : 'bg-(--ifm-background-color) dark:bg-transparent',
            )}
            onClick={() => onSelect(index)}
            onMouseEnter={() => onHover(index)}
          >
            <p className="mb-0! truncate text-sm font-medium text-(--mastra-text-tertiary) dark:text-white">
              {search.label}
            </p>

            <p className="mb-0! truncate text-sm font-normal text-(--mastra-text-muted)">{search.description}</p>
          </div>
        )
      })}
    </div>
  )
}
