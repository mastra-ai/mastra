import type { GetAgentResponse } from '@mastra/client-js';
import type { AgentCapability } from './agent-capabilities';
import { ALL_AGENT_CAPABILITIES } from './agent-capabilities';
import { AgentCompactCard } from './agent-compact-card';
import { Card, CardContent } from '@/ds/components/Card';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';

export interface AgentsCompactGridProps {
  agents: GetAgentResponse[];
  isLoading: boolean;
  hasSearch: boolean;
  capabilities?: readonly AgentCapability[];
}

const compactGridClassName = 'grid grid-cols-1 gap-2 p-1 md:grid-cols-2';

function AgentsCompactGridSkeleton() {
  return (
    <div className={compactGridClassName}>
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index} className="min-h-24">
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

export function AgentsCompactGrid({
  agents,
  isLoading,
  hasSearch,
  capabilities = ALL_AGENT_CAPABILITIES,
}: AgentsCompactGridProps) {
  return (
    <ScrollArea orientation="vertical" className="size-full">
      {isLoading ? <AgentsCompactGridSkeleton /> : null}

      {!isLoading && agents.length === 0 && hasSearch ? (
        <Txt className="py-5 text-center">No Agents match your search</Txt>
      ) : null}

      {!isLoading && agents.length > 0 ? (
        <ul aria-label="Agents compact grid" className={compactGridClassName}>
          {agents.map(agent => (
            <li key={agent.id} className="min-w-0">
              <AgentCompactCard agent={agent} capabilities={capabilities} />
            </li>
          ))}
        </ul>
      ) : null}
    </ScrollArea>
  );
}
