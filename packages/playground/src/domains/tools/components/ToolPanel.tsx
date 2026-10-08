import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useExecuteTool, useTool } from '@mastra/react/hooks/tools';
import type { ToolExecution } from '../utils/tool-run';
import { ToolWorkspace } from './tool-workspace';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export function ToolPanel({ toolId }: { toolId: string }) {
  const { data: tool, isLoading, error } = useTool({ toolId });
  const { mutateAsync, status, data, error: executionError } = useExecuteTool();
  const { canExecute, isLoading: isLoadingPermissions } = usePermissions();
  const execution: ToolExecution = {
    execute: (input, requestContext) => mutateAsync({ toolId, input, requestContext }),
    status,
    output: data,
    error: executionError,
  };

  if (isLoading || isLoadingPermissions) return <Skeleton className="m-4 h-32" />;
  if (error)
    return <EmptyState variant="fill" tone="error" titleSlot="Unable to load tool" descriptionSlot={error.message} />;
  if (!tool) return <EmptyState variant="fill" titleSlot="Tool not found" />;

  return <ToolWorkspace tool={tool} execution={execution} canRun={canExecute('tools')} />;
}
