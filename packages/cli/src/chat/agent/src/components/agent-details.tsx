import { Skeleton } from '@shared/components/ui/skeleton';
import { useAgent } from '@shared/hooks/use-agents';
import { Fragment } from 'react';

export function AgentDetails({ agentId }: { agentId: string }) {
  const { isLoading, agent } = useAgent(agentId);

  if (isLoading) {
    return (
      <Fragment>
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
      </Fragment>
    );
  }

  return (
    <Fragment>
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
        <p className="text-mastra-el-5">{(agent?.model as any)?.name}</p>
      </div>
      <div className="grid grid-cols-[100px_1fr] gap-2">
        <p className="text-mastra-el-3">Provider</p>
        <p className="text-mastra-el-5">{agent?.model.provider}</p>
      </div>
      <div className="grid grid-cols-[100px_1fr] gap-2">
        <p className="text-mastra-el-3">Tools</p>
        <div className="flex flex-col gap-2 text-mastra-el-5">
          {Object.keys(agent?.tools ?? {}).map(tool => (
            <p key={tool}>{tool}</p>
          ))}
        </div>
      </div>
    </Fragment>
  );
}
