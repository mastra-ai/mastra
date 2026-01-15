import { ToolIconMap } from '@/domains/tools/components/ToolIcon';
import { MCPToolType } from '@mastra/core/mcp';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons';

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

        <div className="flex-1 min-w-0">
          <Txt variant="header-md" as="h2" className="font-medium truncate block" title={toolId}>
            {toolId}
          </Txt>
          <Txt variant="ui-sm" className="text-icon3 line-clamp-2">
            {toolDescription}
          </Txt>
        </div>
      </div>
    </div>
  );
};
