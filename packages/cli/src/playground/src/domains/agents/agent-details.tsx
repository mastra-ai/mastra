import { useNavigate } from 'react-router';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

import { useAgent } from '@/hooks/use-agents';

export function AgentDetails({ agentId }: { agentId: string }) {
  const { isLoading, agent } = useAgent(agentId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs">
        <div className="space-y-4">
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Skeleton className="h-3" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3" />
              <Skeleton className="h-3" />
              <Skeleton className="h-3" />
            </div>
          </div>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs">
      <div className="space-y-4">
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <p className="text-mastra-el-3">Name</p>
          <p className="text-mastra-el-5">{agent?.name}</p>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <p className="text-mastra-el-3">Instructions</p>
          <p className="text-mastra-el-5 whitespace-pre-wrap">{agent?.instructions}</p>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <p className="text-mastra-el-3">Model</p>
          <p className="text-mastra-el-5">{agent?.provider}</p>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <p className="text-mastra-el-3">Provider</p>
          <p className="text-mastra-el-5">{agent?.provider?.split('.')[0].toUpperCase()}</p>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <p className="text-mastra-el-3">Tools</p>
          <div className="flex flex-col gap-2 text-mastra-el-5">
            {Object.entries(agent?.tools ?? {}).map(([toolKey, tool]) => (
              <span
                key={toolKey}
                onClick={() => {
                  navigate(`/tools/${agentId}/${tool.id}`);
                }}
                className="no-underline"
              >
                {tool.id}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
