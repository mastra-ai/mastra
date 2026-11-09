import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { useExecuteTool, useTool } from '@mastra/react/hooks/tools';
import type { ToolExecution } from '../../utils/tool-run';
import { useOpenToolId } from './open-tool-context';
import { ToolDrawerBody } from './tool-drawer-body';

export function ToolsPageDrawerBody() {
  const toolId = useOpenToolId();
  const { data: tool, isLoading } = useTool({ toolId });
  const { mutateAsync, status, data, error } = useExecuteTool();
  const execution: ToolExecution = {
    execute: (input, requestContext) => mutateAsync({ toolId, input, requestContext }),
    status,
    output: data,
    error,
  };

  if (isLoading) return <DataPanel.LoadingData />;
  if (!tool) return <DataPanel.NoData>Tool "{toolId}" not found.</DataPanel.NoData>;

  return (
    <ToolDrawerBody
      tool={tool}
      execution={execution}
      requestContextEntityType="tool"
      requestContextEntityId={tool.id}
    />
  );
}
