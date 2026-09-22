import type { MCPToolType } from '@mastra/core/mcp';
import { ClampedText } from '@mastra/playground-ui/components/ClampedText';
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
    <div className="flex gap-2 text-foreground">
      <Icon size="lg" className="shrink-0 self-start rounded-md bg-muted p-1">
        <ToolIconComponent />
      </Icon>

      <div className="flex min-w-0 flex-col">
        <Txt variant="heading" as="h2" className="truncate">
          {toolId}
        </Txt>
        <ClampedText variant="caption" className="text-muted-foreground">
          {toolDescription}
        </ClampedText>
      </div>
    </div>
  );
};
