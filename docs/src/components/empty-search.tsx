import { cn } from "@/lib/utils";

export const searches = [
  {
    label: "Quickstart",
    description: "Get up and running with Mastra AI",
    link: "/docs/getting-started/installation",
  },
  {
    label: "Agents",
    description: "Use LLMs and tools to solve open-ended tasks",
    link: "/docs/agents/overview",
  },
  {
    label: "Workflows",
    description: "Define and manage complex sequences of tasks",
    link: "/docs/workflows/overview",
  },
  {
    label: "Playground",
    description: "Test your agents, workflows, and tools during development",
    link: "/docs/server-db/local-dev-playground",
  },
  {
    label: "Streaming",
    description: "Streaming for real-time agent interactions",
    link: "/docs/streaming/overview",
  },
  {
    label: "MCP",
    description: "Connect AI agents to external tools and resources",
    link: "/docs/tools-mcp/mcp-overview",
  },
  {
    label: "Memory",
    description: "Manage agent context across conversations",
    link: "/docs/memory/overview",
  },
  {
    label: "Scorers",
    description: "Evaluate agent performance",
    link: "/docs/scorers/overview",
  },
  {
    label: "RAG",
    description: "Incorporate relevant context from your own data sources",
    link: "/docs/rag/overview",
  },
  {
    label: "Observability",
    description: "Monitor and log agent activity",
    link: "/docs/observability/overview",
  },
  {
    label: "Deployment",
    description: "Deploy your agents, workflows, and tools",
    link: "/docs/deployment/overview",
  },
];

export function EmptySearch({
  selectedIndex,
  onSelect,
  onHover,
}: {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {searches.map((search, index) => {
        const isSelected = selectedIndex === index;
        return (
          <div
            key={search.link}
            className={cn(
              "flex flex-col gap-1 p-2 rounded-md cursor-pointer",
              isSelected
                ? "dark:bg-surface-5 bg-[var(--light-color-surface-2)]"
                : "bg-[var(--light-color-surface-15)] dark:bg-surface-4",
            )}
            onClick={() => onSelect(index)}
            onMouseEnter={() => onHover(index)}
          >
            <p className="text-sm font-medium truncate dark:text-icons-6 text-[var(--light-color-text-4)]">
              {search.label}
            </p>

            <p className="text-sm font-normal truncate text-icons-3">
              {search.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
