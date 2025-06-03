import { ToolIconMap } from '@/types';
import { MCPToolType } from '@mastra/core/mcp';
import { Icon, Txt } from '@mastra/playground-ui';

export interface ToolInformationProps {
  toolDescription: string;
  toolId: string;
  toolType?: MCPToolType;
}

export const ToolInformation = ({ toolDescription, toolId, toolType }: ToolInformationProps) => {
  const ToolIconComponent = ToolIconMap[toolType || 'tool'];

  return (
    <div className="p-5 border-b-sm border-border1">
      <div className="text-icon6 flex gap-2">
        <div>
          <Icon size="lg" className="bg-surface4 rounded-md p-1">
            <ToolIconComponent />
          </Icon>
        </div>

        <div className="flex gap-4 justify-between w-full min-w-0">
          <div>
            <Txt variant="header-md" as="h2" className="font-medium truncate">
              {toolId}
            </Txt>
            <Txt variant="ui-sm" className="text-icon3">
              {toolDescription}
            </Txt>
          </div>
        </div>
      </div>
    </div>
  );
};
