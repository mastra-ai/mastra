import { useEffect, useRef } from "react";
import { cn } from "../css/utils";

export const searches = [
  {
    label: "Quickstart",
    description: "Get up and running with Mastra AI",
    link: "/docs/v1/getting-started/installation",
  },
  {
    label: "Agents",
    description: "Use LLMs and tools to solve open-ended tasks",
    link: "/docs/v1/agents/overview",
  },
  {
    label: "Workflows",
    description: "Define and manage complex sequences of tasks",
    link: "/docs/v1/workflows/overview",
  },
  {
    label: "Playground",
    description: "Test your agents, workflows, and tools during development",
    link: "/docs/v1/server-db/local-dev-playground",
  },
  {
    label: "Streaming",
    description: "Streaming for real-time agent interactions",
    link: "/docs/v1/streaming/overview",
  },
  {
    label: "MCP",
    description: "Connect AI agents to external tools and resources",
    link: "/docs/v1/tools-mcp/mcp-overview",
  },
  {
    label: "Memory",
    description: "Manage agent context across conversations",
    link: "/docs/v1/memory/overview",
  },
  {
    label: "Scorers",
    description: "Evaluate agent performance",
    link: "/docs/v1/scorers/overview",
  },
  {
    label: "RAG",
    description: "Incorporate relevant context from your own data sources",
    link: "/docs/v1/rag/overview",
  },
  {
    label: "Observability",
    description: "Monitor and log agent activity",
    link: "/docs/v1/observability/overview",
  },
  {
    label: "Deployment",
    description: "Deploy your agents, workflows, and tools",
    link: "/docs/v1/deployment/overview",
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
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll selected item into view when navigating with keyboard
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  return (
    <div className="flex flex-col gap-1">
      {searches.map((search, index) => {
        const isSelected = selectedIndex === index;
        return (
          <div
            key={search.link}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            className={cn(
              "flex flex-col gap-1 p-2 rounded-md cursor-pointer",
              isSelected
                ? "dark:bg-(--mastra-surface-5) bg-(--mastra-surface-2)"
                : "bg-(--ifm-background-color) dark:bg-transparent",
            )}
            onClick={() => onSelect(index)}
            onMouseEnter={() => onHover(index)}
          >
            <p className="text-sm mb-0! font-medium truncate dark:text-white text-(--mastra-text-tertiary)">
              {search.label}
            </p>

            <p className="text-sm font-normal mb-0! truncate text-(--mastra-text-muted)">
              {search.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
