import { Txt } from '@/ds/components/Txt';
import { WorkflowCard } from './workflow-card';
import { DeploymentIcon, Icon } from '@/ds/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { CodeBlockDemo } from '@/components/ui/code-block';

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
export interface WorkflowResultProps {
  jsonResult: string;
  sanitizedJsonResult?: string | null;
}

export const WorkflowResult = ({ jsonResult, sanitizedJsonResult }: WorkflowResultProps) => {
  const { handleCopy } = useCopyToClipboard({ text: jsonResult });
  const [expanded, setExpanded] = useState(false);

  return (
    <WorkflowCard
      header={
        <div className="flex items-center gap-2 justify-between w-full">
          <Txt variant="ui-lg" className="text-icon6 flex items-center gap-3 font-medium">
            <Icon>
              <DeploymentIcon />
            </Icon>
            Workflow Execution (JSON)
          </Txt>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-2 rounded-lg hover:bg-surface5 transition-colors duration-150 ease-in-out text-icon3 hover:text-icon6"
                onClick={() => handleCopy()}
              >
                <Icon size="sm">
                  <CopyIcon />
                </Icon>
              </button>
            </TooltipTrigger>
            <TooltipContent>Copy result</TooltipContent>
          </Tooltip>
        </div>
      }
      footer={
        <button
          className="w-full h-full text-center text-icon2 hover:text-icon6 text-ui-md"
          onClick={() => setExpanded(s => !s)}
        >
          {expanded ? 'collapse' : 'expand'}
        </button>
      }
      children={
        expanded ? (
          <CodeBlockDemo className="w-full overflow-x-auto" code={sanitizedJsonResult || jsonResult} language="json" />
        ) : null
      }
    />
  );
};
