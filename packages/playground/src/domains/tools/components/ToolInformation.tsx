import type { MCPToolType } from '@mastra/core/mcp';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ToolIconMap } from '@/domains/tools/components/ToolIcon';

export interface ToolInformationProps {
  toolDescription: string;
  toolId: string;
  toolType?: MCPToolType;
}

export const ToolInformation = ({ toolDescription, toolId, toolType }: ToolInformationProps) => {
  const ToolIconComponent = ToolIconMap[toolType || 'tool'];

  return (
    <div className="border-b border-border1 p-5">
      <div className="flex gap-2 text-neutral6">
        <div>
          <Icon size="lg" className="rounded-md bg-surface4 p-1">
            <ToolIconComponent />
          </Icon>
        </div>

        <div className="flex w-full min-w-0 justify-between gap-4">
          <div>
            <Txt variant="header-md" as="h2" className="truncate font-medium">
              {toolId}
            </Txt>
            <Txt variant="ui-sm" className="text-neutral3">
              {toolDescription}
            </Txt>
          </div>
        </div>
      </div>
    </div>
  );
};
