import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Icon, Txt, ToolsIcon } from '@mastra/playground-ui';
import { CopyIcon } from 'lucide-react';

export interface ToolInformationProps {
  toolDescription: string;
  toolId: string;
}

export const ToolInformation = ({ toolDescription, toolId }: ToolInformationProps) => {
  const { handleCopy } = useCopyToClipboard({ text: toolId });
  return (
    <div className="p-5 border-b-sm border-border1">
      <div className="text-icon6 flex gap-2">
        <div>
          <Icon size="lg" className="bg-surface4 rounded-md p-1">
            <ToolsIcon />
          </Icon>
        </div>

        <div className="flex gap-4 justify-between w-full">
          <div>
            <Txt variant="header-md" as="h2" className="font-medium">
              {toolId}
            </Txt>
            <Txt variant="ui-sm" className="text-icon3">
              {toolDescription}
            </Txt>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleCopy}>
                <Icon className="transition-colors hover:bg-surface4 rounded-lg text-icon3 hover:text-icon6">
                  <CopyIcon />
                </Icon>
              </button>
            </TooltipTrigger>
            <TooltipContent>Copy Tool ID for use in code</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
