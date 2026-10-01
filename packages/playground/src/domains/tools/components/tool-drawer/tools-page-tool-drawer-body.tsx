import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { useTool } from '../../hooks/use-all-tools';
import { useExecuteTool } from '../../hooks/use-execute-tool';
import { ToolDrawerBody } from './tool-drawer-body';

export interface ToolsPageDrawerBodyProps {
  toolId: string;
}

export function ToolsPageDrawerBody({ toolId }: ToolsPageDrawerBodyProps) {
  const { data: tool, isLoading } = useTool(toolId);
  const { mutateAsync } = useExecuteTool();

  if (isLoading) return <DataPanel.LoadingData />;
  if (!tool) return <DataPanel.NoData>Tool "{toolId}" not found.</DataPanel.NoData>;

  return (
    <ToolDrawerBody
      tool={tool}
      execute={(data, requestContext) => mutateAsync({ toolId, input: data, requestContext })}
      requestContextEntityType="tool"
      requestContextEntityId={toolId}
    />
  );
}
