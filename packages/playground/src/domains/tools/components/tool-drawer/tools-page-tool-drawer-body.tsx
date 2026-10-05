import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { useExecuteTool, useTool } from '@mastra/react/hooks';
import type { ExecuteTool } from '../../hooks/use-tool-run';
import { ToolDrawerBody } from './tool-drawer-body';

export interface ToolsPageDrawerBodyProps {
  toolId: string;
}

export function ToolsPageDrawerBody({ toolId }: ToolsPageDrawerBodyProps) {
  const { data: tool, isLoading } = useTool(toolId);
  const { mutateAsync } = useExecuteTool();
  const execute: ExecuteTool = (data, requestContext) => mutateAsync({ toolId, input: data, requestContext });

  if (isLoading) return <DataPanel.LoadingData />;
  if (!tool) return <DataPanel.NoData>Tool "{toolId}" not found.</DataPanel.NoData>;

  return (
    <ToolDrawerBody tool={tool} execute={execute} requestContextEntityType="tool" requestContextEntityId={tool.id} />
  );
}
