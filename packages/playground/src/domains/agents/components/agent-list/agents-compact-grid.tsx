import type { GetAgentResponse } from '@mastra/client-js';
import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { AgentCompactCard } from './agent-compact-card';

export interface AgentsCompactGridProps {
  agents: GetAgentResponse[];
  isLoading: boolean;
  hasSearch: boolean;
}

const compactGridClassName = 'grid grid-cols-1 gap-2 md:grid-cols-2';

function AgentsCompactGridSkeleton() {
  return (
    <div className={compactGridClassName}>
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index} appearance="surface" className="min-h-24">
          <CardContent density="compact" className="grid gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-full max-w-72" />
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="size-4" />
              <Skeleton className="h-3 w-12" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AgentsCompactGrid({ agents, isLoading, hasSearch }: AgentsCompactGridProps) {
  return (
    <ScrollArea orientation="vertical" className="size-full">
      {isLoading ? <AgentsCompactGridSkeleton /> : null}

      {!isLoading && agents.length === 0 && hasSearch ? (
        <Txt className="py-8 text-center">No Agents match your search</Txt>
      ) : null}

      {!isLoading && agents.length > 0 ? (
        <ul aria-label="Agents compact grid" className={compactGridClassName}>
          {agents.map(agent => (
            <li key={agent.id} className="min-w-0">
              <AgentCompactCard agent={agent} />
            </li>
          ))}
        </ul>
      ) : null}
    </ScrollArea>
  );
}
